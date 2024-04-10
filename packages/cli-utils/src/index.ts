import sade from 'sade';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'json5';
import { printSchema } from 'graphql';
import type { GraphQLSchema } from 'graphql';
import type { TsConfigJson } from 'type-fest';
import { load } from '@gql.tada/internal';

import { getGraphQLSPConfig } from './lsp';
import { ensureTadaIntrospection } from './tada';
import { getTsConfig } from './tsconfig';
import { executeTadaDoctor } from './commands/doctor';
import { check } from './commands/check';
import { initGqlTada } from './commands/init';
import { generatePersisted } from './commands/generate-persisted';
import { generateGraphQLCache } from './commands/cache';

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
  const tsConfig = await getTsConfig();
  if (!tsConfig) {
    return;
  }

  const config = getGraphQLSPConfig(tsConfig);
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
    .command('init <folder>')
    .describe('Bootstraps your project with gql.tada.')
    .action(async (folder) => {
      const target = path.resolve(process.cwd(), folder);
      await initGqlTada(target);
    })
    .command('cache')
    .action(async () => {
      await generateGraphQLCache();
    })
    .command('doctor')
    .describe('Finds common issues in your gql.tada setup.')
    .action(async () => {
      return executeTadaDoctor();
    })
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
    .command('generate-persisted <target>')
    .action(async (target) => {
      await generatePersisted(target);
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
    .option('--level', 'The minimum severity of diagnostics to display (error | warn | info).')
    .option('--exit-on-warn', 'Whether to exit with a non-zero code when there are warnings.')
    .action(async (opts) => {
      check({
        exitOnWarn: opts['exit-on-warn'] !== undefined ? opts['exit-on-warn'] : false,
        minSeverity: opts.level || 'error',
      });
    });
  prog.parse(process.argv);
}

export default main;
