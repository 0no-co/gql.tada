import sade from 'sade';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'json5';
import { printSchema } from 'graphql';
import semiver from 'semiver';
import type { GraphQLSchema } from 'graphql';
import type { TsConfigJson } from 'type-fest';
import { resolveTypeScriptRootDir, load } from '@gql.tada/internal';

import { getGraphQLSPConfig } from './lsp';
import { ensureTadaIntrospection } from './tada';
import { existsSync } from 'node:fs';

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
    .command('doctor')
    .describe('Finds common issues in your gql.tada setup.')
    .action(async () => {
      // Check TypeScript version
      const cwd = process.cwd();
      const packageJsonPath = path.resolve(cwd, 'package.json');
      let packageJsonContents: {
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
      };
      try {
        const file = path.resolve(packageJsonPath);
        packageJsonContents = JSON.parse(await fs.readFile(file, 'utf-8'));
      } catch (error) {
        console.error(
          'Failed to read package.json in current working directory, try running the doctor command in your workspace folder.'
        );
        return;
      }

      const typeScriptVersion = Object.entries({
        ...packageJsonContents.dependencies,
        ...packageJsonContents.devDependencies,
      }).find((x) => x[0] === 'typescript');
      if (!typeScriptVersion) {
        console.error('Failed to find a typescript installation, try installing one.');
        return;
      } else if (semiver(typeScriptVersion[1], '4.1.0') === -1) {
        // TypeScript version lower than v4.1 which is when they introduced template lits
        console.error('Found an outdated TypeScript version, gql.tada requires at least 4.1.0.');
        return;
      }

      const tsconfigpath = path.resolve(cwd, 'tsconfig.json');

      const root = (await resolveTypeScriptRootDir(tsconfigpath)) || cwd;

      let tsconfigContents: string;
      try {
        const file = path.resolve(root, 'tsconfig.json');
        tsconfigContents = await fs.readFile(file, 'utf-8');
      } catch (error) {
        console.error(
          'Failed to read tsconfig.json in current working directory, try adding a "tsconfig.json".'
        );
        return;
      }

      let tsConfig: TsConfigJson;
      try {
        tsConfig = parse(tsconfigContents) as TsConfigJson;
      } catch (err) {
        console.error('Unable to parse tsconfig.json in current working directory.', err);
        return;
      }

      // Check GraphQLSP version, later on we can check if a ts version is > 5.5.0 to use gql.tada/lsp instead of
      // the LSP package.
      const config = getGraphQLSPConfig(tsConfig);
      if (!config) {
        console.error(`Missing a "@0no-co/graphqlsp" plugin in your tsconfig.`);
        return;
      }

      // TODO: this is optional I guess with the CLI being there and all
      if (!config.tadaOutputLocation) {
        console.error(`Missing a "tadaOutputLocation" setting in your GraphQLSP configuration.`);
        return;
      }

      if (!config.schema) {
        console.error(`Missing a "schema" setting in your GraphQLSP configuration.`);
        return;
      } else {
        const isFile =
          typeof config.schema === 'string' &&
          (config.schema.endsWith('.json') || config.schema.endsWith('.graphql'));
        if (isFile) {
          const resolvedFile = path.resolve(root, config.schema as string);
          if (!existsSync(resolvedFile)) {
            console.error(
              `The schema setting does not point at an existing file "${resolvedFile}"`
            );
            return;
          }
        } else {
          try {
            typeof config.schema === 'string' ? new URL(config.schema) : new URL(config.schema.url);
          } catch (e) {
            console.error(
              `The schema setting does not point at a valid URL "${JSON.stringify(config.schema)}"`
            );
            return;
          }
        }
      }
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
    });
  prog.parse(process.argv);
}

export default main;
