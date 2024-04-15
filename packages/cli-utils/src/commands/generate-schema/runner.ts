import path from 'node:path';
import { printSchema } from 'graphql';
import type { GraphQLSchema } from 'graphql';
import type { GraphQLSPConfig, LoadConfigResult } from '@gql.tada/internal';
import { load, loadConfig, parseConfig } from '@gql.tada/internal';

import type { TTY, ComposeInput } from '../../term';
import type { WriteTarget } from '../shared';
import { writeOutput } from '../shared';
import * as logger from './logger';

interface Options {
  input: string;
  headers: Record<string, string> | undefined;
  output: string | undefined;
  tsconfig: string | undefined;
}

export async function* run(tty: TTY, opts: Options): AsyncIterable<ComposeInput> {
  const origin = opts.headers ? { url: opts.input, headers: opts.headers } : opts.input;
  const loader = load({ rootPath: process.cwd(), origin });

  let schema: GraphQLSchema | null;
  try {
    schema = await loader.loadSchema();
  } catch (error) {
    throw logger.externalError('Failed to load schema.', error);
  }

  if (!schema) {
    throw logger.errorMessage('Failed to load schema.');
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
