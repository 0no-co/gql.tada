import * as path from 'node:path';
import type { GraphQLSPConfig, LoadConfigResult } from '@gql.tada/internal';

import {
  loadRef,
  loadConfig,
  parseConfig,
  minifyIntrospection,
  outputIntrospectionFile,
} from '@gql.tada/internal';

import type { TTY, ComposeInput } from '../../term';
import type { WriteTarget } from '../shared';
import { writeOutput } from '../shared';
import * as logger from './logger';

export interface OutputOptions {
  /** Whether to output the `.ts` format when the CLI's standard output is piped to an output file.
   * @defaultValue `false` */
  forceTSFormat?: boolean;
  /** Whether to disable the optimized output format for `.d.ts` files.
   * @defaultValue `false` */
  disablePreprocessing?: boolean;
  /** The filename to write the cache file to.
   * @defaultValue The `tadaTurboLocation` configuration option */
  output: string | undefined;
  /** The `tsconfig.json` to use for configurations and the TypeScript program.
   * @defaultValue A `tsconfig.json` in the current or any parent directory. */
  tsconfig: string | undefined;
}

export async function* run(tty: TTY, opts: OutputOptions): AsyncIterable<ComposeInput> {
  let configResult: LoadConfigResult;
  let pluginConfig: GraphQLSPConfig;
  try {
    configResult = await loadConfig(opts.tsconfig);
    pluginConfig = parseConfig(configResult.pluginConfig, configResult.rootPath);
  } catch (error) {
    throw logger.externalError('Failed to load configuration.', error);
  }

  let schemaRef = loadRef(pluginConfig);
  try {
    schemaRef = await schemaRef.load({ rootPath: path.dirname(configResult.configPath) });
  } catch (error) {
    throw logger.externalError('Failed to load schema(s).', error);
  }

  const projectPath = path.dirname(configResult.configPath);
  if ('schema' in pluginConfig) {
    const schema = schemaRef.current!;

    let destination: WriteTarget;
    if (!opts.output && tty.pipeTo) {
      destination = tty.pipeTo;
    } else if (opts.output) {
      destination = path.resolve(process.cwd(), opts.output);
    } else if (pluginConfig.tadaOutputLocation) {
      destination = pluginConfig.tadaOutputLocation;
    } else {
      throw logger.errorMessage(
        'No output path was specified to write the output file to.\n' +
          logger.hint(
            `You have to either set ${logger.code(
              '"tadaOutputLocation"'
            )} in your configuration,\n` +
              `pass an ${logger.code('--output')} argument to this command,\n` +
              'or pipe this command to an output file.'
          )
      );
    }

    let contents: string;
    try {
      contents = outputIntrospectionFile(minifyIntrospection(schema.introspection), {
        fileType:
          destination && typeof destination === 'string'
            ? destination
            : opts.forceTSFormat
              ? '.ts'
              : '.d.ts',
        shouldPreprocess: !opts.disablePreprocessing,
      });
    } catch (error) {
      throw logger.externalError('Could not generate introspection output', error);
    }

    try {
      await writeOutput(destination, contents);
    } catch (error) {
      throw logger.externalError(
        'Something went wrong while writing the introspection file',
        error
      );
    }

    yield logger.summary(!opts.forceTSFormat && typeof destination !== 'string');
  } else {
    if (opts.output) {
      throw logger.errorMessage(
        'Output path was specified, while multiple schemas are configured.\n' +
          logger.hint(
            `You can only output all schemas to their ${logger.code(
              '"tadaOutputLocation"'
            )} options\n` + `when multiple ${logger.code('schemas')} are set up.`
          )
      );
    }

    for (const schemaName in schemaRef.multi) {
      const schema = schemaRef.multi[schemaName];
      if (!schema) {
        continue;
      } else if (!schema.tadaOutputLocation) {
        throw logger.errorMessage(
          `No output path was specified to write the '${schemaName}' schema to.\n` +
            logger.hint(
              `You have to set ${logger.code('"tadaOutputLocation"')} in each schema configuration.`
            )
        );
      }

      let contents: string;
      try {
        contents = outputIntrospectionFile(minifyIntrospection(schema.introspection), {
          fileType: schema.tadaOutputLocation,
          shouldPreprocess: !opts.disablePreprocessing,
        });
      } catch (error) {
        throw logger.externalError(
          `Could not generate any output for the '${schemaName}' schema`,
          error
        );
      }

      try {
        await writeOutput(path.resolve(projectPath, schema.tadaOutputLocation), contents);
      } catch (error) {
        throw logger.externalError(
          `Something went wrong while writing the '${schemaName}' schema's output`,
          error
        );
      }
    }

    yield logger.summary();
  }
}
