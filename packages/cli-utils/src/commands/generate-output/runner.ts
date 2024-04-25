import * as path from 'node:path';
import type { GraphQLSPConfig, LoadConfigResult } from '@gql.tada/internal';
import type { IntrospectionQuery } from 'graphql';

import {
  load,
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
  disablePreprocessing: boolean;
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

  if (!('schema' in pluginConfig)) {
    // TODO: Implement multi-schema support
    throw logger.errorMessage('Multi-schema support is not implemented yet');
  }

  // TODO: allow this to be overwritten using arguments (like in `generate schema`)
  const loader = load({
    origin: pluginConfig.schema,
    rootPath: path.dirname(configResult.configPath),
  });

  let introspection: IntrospectionQuery;
  try {
    const loadResult = await loader.load();
    introspection = loadResult.introspection;
  } catch (error) {
    throw logger.externalError('Failed to load introspection.', error);
  }

  let destination: WriteTarget;
  if (!opts.output && tty.pipeTo) {
    destination = tty.pipeTo;
  } else if (opts.output) {
    destination = path.resolve(process.cwd(), opts.output);
  } else if (pluginConfig.tadaOutputLocation) {
    destination = path.resolve(
      path.dirname(configResult.configPath),
      pluginConfig.tadaOutputLocation
    );
  } else {
    throw logger.errorMessage(
      'No output path was specified to write the output file to.\n' +
        logger.hint(
          `You have to either set ${logger.code('"tadaOutputLocation"')} in your configuration,\n` +
            `pass an ${logger.code('--output')} argument to this command,\n` +
            'or pipe this command to an output file.'
        )
    );
  }

  let contents: string;
  try {
    contents = outputIntrospectionFile(minifyIntrospection(introspection), {
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
    throw logger.externalError('Something went wrong while writing the introspection file', error);
  }

  yield logger.summary(!opts.forceTSFormat && typeof destination !== 'string');
}
