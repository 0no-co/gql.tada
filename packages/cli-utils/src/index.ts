import sade from 'sade';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'json5';
import { printSchema } from 'graphql';

import type { GraphQLSchema } from 'graphql';
import type { TsConfigJson } from 'type-fest';
import {
  resolveTypeScriptRootDir,
  load,
  check,
  type FormattedDisplayableDiagnostic,
} from '@gql.tada/internal';

import type { GraphQLSPConfig } from './lsp';
import { getGraphQLSPConfig } from './lsp';
import { ensureTadaIntrospection } from './tada';

interface GenerateSchemaOptions {
  headers?: Record<string, string>;
  output?: string;
  cwd?: string;
}

export async function generateSchema(
  target: string,
  { headers, output, cwd = process.cwd() }: GenerateSchemaOptions
) {
  const origin = headers ? { url: target, headers } : target;
  const loader = load({ origin, rootPath: cwd });

  let schema: GraphQLSchema | null;
  try {
    schema = await loader.loadSchema();
  } catch (error) {
    console.error('Something went wrong while trying to load the schema.', error);
    return;
  }

  if (!schema) {
    console.error('Could not load the schema.');
    return;
  }

  let destination = output;
  if (!destination) {
    let tsconfigContents: string;
    try {
      tsconfigContents = await fs.readFile('tsconfig.json', 'utf-8');
    } catch (error) {
      console.error('Failed to read tsconfig.json in current working directory.', error);
      return;
    }

    let tsConfig: TsConfigJson;
    try {
      tsConfig = parse(tsconfigContents) as TsConfigJson;
    } catch (err) {
      console.error(err);
      return;
    }

    const config = getGraphQLSPConfig(tsConfig);
    if (!config) {
      console.error(`Could not find a "@0no-co/graphqlsp" plugin in your tsconfig.`);
      return;
    } else if (typeof config.schema !== 'string' || !config.schema.endsWith('.graphql')) {
      console.error(`Found "${config.schema}" which is not a path to a .graphql SDL file.`);
      return;
    } else {
      destination = config.schema;
    }
  }

  // TODO: Should the output be relative to the relevant `tsconfig.json` file?
  await fs.writeFile(path.resolve(cwd, destination), printSchema(schema), 'utf-8');
}

export async function generateTadaTypes(shouldPreprocess = false, cwd: string = process.cwd()) {
  const config = await getConfig();
  if (!config) {
    return;
  }

  return await ensureTadaIntrospection(
    config.schema,
    config.tadaOutputLocation,
    cwd,
    shouldPreprocess
  );
}

const prog = sade('gql.tada');

prog.version(process.env.npm_package_version || '0.0.0');

async function main() {
  prog
    .command('generate-schema <target>')
    .describe(
      'Generate a GraphQL schema from a URL or introspection file, this will be generated from the parameters to this command.'
    )
    .option('--header', 'Pass a header to be used when fetching the introspection.')
    .option(
      '--output',
      'A specialised location to output the schema to, by default we\'ll output the schema to the "schema" defined in your "tsconfig".'
    )
    .example("generate-schema https://example.com --header 'Authorization: Bearer token'")
    .example('generate-schema ./introspection.json')
    .action(async (target, options) => {
      const parsedHeaders = {};

      if (typeof options.header === 'string') {
        const [key, value] = options.header.split(':').map((part) => part.trim());
        parsedHeaders[key] = value;
      } else if (Array.isArray(options.header)) {
        options.header.forEach((header) => {
          const [key, value] = header.split(':').map((part) => part.trim());
          parsedHeaders[key] = value;
        });
      }

      return generateSchema(target, {
        headers: Object.keys(parsedHeaders).length ? parsedHeaders : undefined,
        output: options.output,
      });
    })
    .command('generate-output')
    .option(
      '--disable-preprocessing',
      'Disables pre-processing, which is an internal introspection format generated ahead of time'
    )
    .describe(
      'Generate the gql.tada types file, this will look for your "tsconfig.json" and use the "@0no-co/graphqlsp" configuration to generate the file.'
    )
    .action((options) => {
      const shouldPreprocess =
        !options['disable-preprocessing'] && options['disable-preprocessing'] !== 'false';
      return generateTadaTypes(shouldPreprocess);
    })
    .command('check')
    .option('--severity', 'The minimum severity of diagnostics to display.')
    .action(async (opts) => {
      const config = await getConfig();
      if (!config) {
        return;
      }
      const result = (await check(config, opts.severity || 'error')) || [];
      const errorDiagnostics = result.filter((d) => d.severity === 'error');
      const warnDiagnostics = result.filter((d) => d.severity === 'warn');
      const infoDiagnostics = result.filter((d) => d.severity === 'info');
      if (
        errorDiagnostics.length === 0 &&
        warnDiagnostics.length === 0 &&
        infoDiagnostics.length === 0
      ) {
        // eslint-disable-next-line no-console
        console.log('No issues found! 🎉');
        return;
      } else {
        const errorReport = errorDiagnostics.length
          ? `Found ${errorDiagnostics.length} Errors:\n\n${constructDiagnosticsPerFile(
              errorDiagnostics
            )}\n\n`
          : ``;
        const warningsReport = warnDiagnostics.length
          ? `Found ${warnDiagnostics.length} Warnings:\n\n${constructDiagnosticsPerFile(
              warnDiagnostics
            )}\n\n`
          : ``;
        const suggestionsReport = infoDiagnostics.length
          ? `Found ${infoDiagnostics.length} Suggestions:\n\n${constructDiagnosticsPerFile(
              infoDiagnostics
            )}\n\n`
          : ``;
        // eslint-disable-next-line no-console
        console.log(`${errorReport}${warningsReport}${suggestionsReport}`);
      }
    });
  prog.parse(process.argv);
}

function constructDiagnosticsPerFile(diagnostics: FormattedDisplayableDiagnostic[]): string {
  const diagnosticsByFile = diagnostics.reduce<Record<string, string[]>>((acc, diag) => {
    const file = diag.file || '';
    if (!acc[file]) {
      acc[file] = [];
    }
    acc[file].push(`[${diag.line}:${diag.col}] ${diag.message}`);
    return acc;
  }, {});

  return Object.entries(diagnosticsByFile).reduce((acc, [fileName, diagnostics]) => {
    return `${acc}${fileName}\n${diagnostics.join('\n')}\n\n`;
  }, '');
}

const getConfig = async (): Promise<GraphQLSPConfig | undefined> => {
  const cwd = process.cwd();
  const tsconfigpath = path.resolve(cwd, 'tsconfig.json');

  // TODO: Remove redundant read and move tsconfig.json handling to internal package
  const root = (await resolveTypeScriptRootDir(tsconfigpath)) || cwd;

  let tsconfigContents: string;
  try {
    const file = path.resolve(root, 'tsconfig.json');
    tsconfigContents = await fs.readFile(file, 'utf-8');
  } catch (error) {
    console.error('Failed to read tsconfig.json in current working directory.', error);
    return;
  }

  let tsConfig: TsConfigJson;
  try {
    tsConfig = parse(tsconfigContents) as TsConfigJson;
  } catch (err) {
    console.error(err);
    return;
  }

  const config = getGraphQLSPConfig(tsConfig);
  if (!config) {
    console.error(`Could not find a "@0no-co/graphqlsp" plugin in your tsconfig.`);
    return;
  }

  return config;
};

export default main;
