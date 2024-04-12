import fs from 'node:fs/promises';
import path from 'node:path';
import { printSchema } from 'graphql';
import type { GraphQLSchema } from 'graphql';
import { load } from '@gql.tada/internal';

import type { TTY } from '../../term';
import { getGraphQLSPConfig } from '../../lsp';
import { getTsConfig } from '../../tsconfig';

interface Options {
  input: string;
  headers: Record<string, string> | undefined;
  output: string | undefined;
  tsconfig: string | undefined;
}

export async function run(tty: TTY, opts: Options) {
  const origin = opts.headers ? { url: opts.input, headers: opts.headers } : opts.input;
  const loader = load({ rootPath: process.cwd(), origin });

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

  let destination: string;
  if (!opts.output && tty.pipeTo) {
    tty.pipeTo.write(printSchema(schema));
    return;
  } else if (opts.output) {
    destination = opts.output;
  } else {
    const tsconfig = await getTsConfig(opts.tsconfig);
    const config = tsconfig && getGraphQLSPConfig(tsconfig);
    if (!tsconfig) {
      console.error('Could not find a tsconfig.json file');
      return;
    } else if (!config) {
      console.error('Could not find a "@0no-co/graphqlsp" plugin in your tsconfig.');
      return;
    } else if (typeof config.schema !== 'string' || !config.schema.endsWith('.graphql')) {
      console.error(`Found "${config.schema}" which is not a path to a .graphql SDL file.`);
      return;
    } else {
      destination = config.schema;
    }
  }

  const resolved = path.resolve(process.cwd(), destination);
  await fs.writeFile(resolved, printSchema(schema));
}
