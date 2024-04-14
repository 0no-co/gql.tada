import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { GraphQLSPConfig, LoadConfigResult } from '@gql.tada/internal';
import type { IntrospectionQuery } from 'graphql';

import {
  load,
  loadConfig,
  parseConfig,
  minifyIntrospection,
  outputIntrospectionFile,
} from '@gql.tada/internal';

import type { TTY } from '../../term';
import type { WriteTarget } from '../shared';
import { writeOutput } from '../shared';
import * as logger from './logger';

interface Options {
  disablePreprocessing: boolean;
  output: string | undefined;
  tsconfig: string | undefined;
}

export async function* run(tty: TTY, opts: Options) {
  let configResult: LoadConfigResult;
  let pluginConfig: GraphQLSPConfig;
  try {
    configResult = await loadConfig(opts.tsconfig);
    pluginConfig = parseConfig(configResult.pluginConfig);
  } catch (error) {
    throw logger.externalError('Failed to load configuration.', error);
  }

  // TODO: allow this to be overwritten using arguments (like in `generate schema`)
  const loader = load({
    origin: pluginConfig.schema,
    rootPath: path.dirname(configResult.configPath),
  });

  let introspection: IntrospectionQuery | null;
  try {
    introspection = await loader.loadIntrospection();
  } catch (error) {
    throw logger.externalError('Failed to load introspection.', error);
  }

  if (!introspection) {
    throw logger.errorMessage('Failed to load introspection.');
  }

  let contents: string;
  try {
    contents = outputIntrospectionFile(minifyIntrospection(introspection), {
      fileType: pluginConfig.tadaOutputLocation || '.d.ts',
      shouldPreprocess: !opts.disablePreprocessing,
    });
  } catch (error) {
    throw logger.externalError('Could not generate introspection output', error);
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

  try {
    await writeOutput(destination, contents);
  } catch (error) {
    throw logger.externalError('Something went wrong while writing the introspection file', error);
  }
}
