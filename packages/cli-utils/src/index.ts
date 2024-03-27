import sade from 'sade';
import { promises as fs, existsSync, readFileSync } from 'node:fs';
import path, { resolve } from 'node:path';
import { parse } from 'json5';
import type { IntrospectionQuery } from 'graphql';
import { buildClientSchema, getIntrospectionQuery, printSchema } from 'graphql';
import type { TsConfigJson } from 'type-fest';
import { resolveTypeScriptRootDir } from '@gql.tada/internal';

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
  let url: URL | undefined;

  try {
    url = new URL(target);
  } catch (e) {}

  let introspection: IntrospectionQuery;
  if (url) {
    const response = await fetch(url!.toString(), {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: getIntrospectionQuery({
          descriptions: true,
          schemaDescription: false,
          inputValueDeprecation: false,
          directiveIsRepeatable: false,
          specifiedByUrl: false,
        }),
      }),
    });

    if (response.ok) {
      const text = await response.text();

      try {
        const result = JSON.parse(text);
        if (result.data) {
          introspection = (result as { data: IntrospectionQuery }).data;
        } else {
          console.error(`Got invalid response ${JSON.stringify(result)}`);
          return;
        }
      } catch (e) {
        console.error(`Got invalid JSON ${text}`);
        return;
      }
    } else {
      console.error(`Got invalid response ${await response.text()}`);
      return;
    }
  } else {
    const path = resolve(cwd, target);
    const fileContents = await fs.readFile(path, 'utf-8');

    try {
      introspection = JSON.parse(fileContents);
    } catch (e) {
      console.error(`Got invalid JSON ${fileContents}`);
      return;
    }
  }

  const schema = buildClientSchema(introspection!);

  let destination = output;
  if (!destination) {
    const tsconfigpath = path.resolve(cwd, 'tsconfig.json');
    const hasTsConfig = existsSync(tsconfigpath);
    if (!hasTsConfig) {
      console.error(`Could not find a tsconfig in the working-directory.`);
      return;
    }

    const tsconfigContents = await fs.readFile(tsconfigpath, 'utf-8');
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

  await fs.writeFile(resolve(cwd, destination), printSchema(schema), 'utf-8');
}

export async function generateTadaTypes(shouldPreprocess = false, cwd: string = process.cwd()) {
  const tsconfigpath = path.resolve(cwd, 'tsconfig.json');
  const hasTsConfig = existsSync(tsconfigpath);
  if (!hasTsConfig) {
    console.error('Missing tsconfig.json');
    return;
  }

  // TODO: Remove redundant read and move tsconfig.json handling to internal package
  const root =
    resolveTypeScriptRootDir(readFileSync as (path: string) => string | undefined, tsconfigpath) ||
    cwd;
  const tsconfigContents = await fs.readFile(path.resolve(root, 'tsconfig.json'), 'utf-8');
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
        headers: parsedHeaders,
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
