import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'json5';
import { printSchema } from 'graphql';
import type { GraphQLSchema } from 'graphql';
import type { TsConfigJson } from 'type-fest';
import { load } from '@gql.tada/internal';
import { getGraphQLSPConfig } from '../lsp';

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
