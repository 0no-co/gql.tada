import path from 'node:path';
import { printSchema } from 'graphql';
import type { GraphQLSchema } from 'graphql';
import type { GraphQLSPConfig, LoadConfigResult } from '@gql.tada/internal';
import { load, loadConfig, parseConfig } from '@gql.tada/internal';

import type { TTY, ComposeInput } from '../../term';
import type { WriteTarget } from '../shared';
import { writeOutput } from '../shared';
import * as logger from './logger';

export interface SchemaOptions {
  /** The filename to a `.graphql` SDL file, introspection JSON, or URL to a GraphQL API to introspect. */
  input: string;
  /** Object of headers to send when introspection a GraphQL API. */
  headers: Record<string, string> | undefined;
  /** The filename to write the GraphQL SDL file to.
   * @defaultValue The `schema` configuration option */
  output: string | undefined;
  /** The `tsconfig.json` to use for configurations and the TypeScript program.
   * @defaultValue A `tsconfig.json` in the current or any parent directory. */
  tsconfig: string | undefined;
}

export async function* run(tty: TTY, opts: SchemaOptions): AsyncIterable<ComposeInput> {
  const origin = opts.headers ? { url: opts.input, headers: opts.headers } : opts.input;
  const loader = load({ rootPath: process.cwd(), origin });

  let schema: GraphQLSchema;
  try {
    const loadResult = await loader.load();
    schema = loadResult.schema;
  } catch (error) {
    throw logger.externalError('Failed to load schema.', error);
  }

  let destination: WriteTarget;
  if (!opts.output && tty.pipeTo) {
    destination = tty.pipeTo;
  } else if (opts.output) {
    destination = path.resolve(process.cwd(), opts.output);
  } else {
    let configResult: LoadConfigResult;
    let pluginConfig: GraphQLSPConfig;
    try {
      configResult = await loadConfig(opts.tsconfig);
      pluginConfig = parseConfig(configResult.pluginConfig);
    } catch (error) {
      throw logger.externalError('Failed to load configuration.', error);
    }

    if (
      typeof pluginConfig.schema === 'string' &&
      path.extname(pluginConfig.schema) === '.graphql'
    ) {
      destination = path.resolve(path.dirname(configResult.configPath), pluginConfig.schema);
    } else {
      throw logger.errorMessage(
        `No output path was specified but writing to ${logger.code(
          'schema'
        )} is not a file path.\n` +
          logger.hint(
            `You have to either set ${logger.code('"schema"')} to a ${logger.code(
              '.graphql'
            )} file in your configuration,\n` +
              `pass an ${logger.code('--output')} argument to this command,\n` +
              'or pipe this command to an output file.'
          )
      );
    }
  }

  try {
    await writeOutput(destination, printSchema(schema));
  } catch (error) {
    throw logger.externalError('Something went wrong while writing the introspection file', error);
  }

  yield logger.summary();
}
