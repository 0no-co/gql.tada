import * as path from 'node:path';
import type { GraphQLSPConfig, LoadConfigResult } from '@gql.tada/internal';

import { loadConfig, parseConfig } from '@gql.tada/internal';

import type { TTY, ComposeInput } from '../../term';
import type { WriteTarget } from '../shared';
import { writeOutput } from '../shared';
import * as logger from './logger';

const PREAMBLE_IGNORE = ['/* eslint-disable */', '/* prettier-ignore */'].join('\n') + '\n';

interface Options {
  failOnWarn: boolean;
  tsconfig: string | undefined;
  output: string | undefined;
}

export async function* run(tty: TTY, opts: Options): AsyncIterable<ComposeInput> {
  const { runTurbo } = await import('./thread');

  let configResult: LoadConfigResult;
  let pluginConfig: GraphQLSPConfig;
  try {
    configResult = await loadConfig(opts.tsconfig);
    pluginConfig = parseConfig(configResult.pluginConfig);
  } catch (error) {
    throw logger.externalError('Failed to load configuration.', error);
  }

  let destination: WriteTarget;
  if (!opts.output && tty.pipeTo) {
    destination = tty.pipeTo;
  } else if (opts.output) {
    destination = path.resolve(process.cwd(), opts.output);
  } else if (pluginConfig.tadaTurboLocation) {
    destination = path.resolve(
      path.dirname(configResult.configPath),
      pluginConfig.tadaTurboLocation
    );
  } else if (pluginConfig.tadaOutputLocation) {
    // TODO: Add a warning that prompts the user to set `tadaTurboLocation` in their configuration
    destination = path.resolve(
      path.dirname(configResult.configPath),
      pluginConfig.tadaOutputLocation,
      '..',
      'graphql-cache.d.ts'
    );
  } else {
    throw logger.errorMessage(
      'No output path was specified to write the output file to.\n' +
        logger.hint(
          `You have to either set ${logger.code('"tadaTurboLocation"')} in your configuration,\n` +
            `pass an ${logger.code('--output')} argument to this command,\n` +
            'or pipe this command to an output file.'
        )
    );
  }

  let cache: Record<string, string> = {};
  const generator = runTurbo({
    rootPath: configResult.rootPath,
    configPath: configResult.configPath,
    pluginConfig,
  });

  let warnings = 0;
  let totalFileCount = 0;
  let fileCount = 0;

  try {
    for await (const signal of generator) {
      if (signal.kind === 'FILE_COUNT') {
        totalFileCount = signal.fileCount;
        continue;
      }

      cache = Object.assign(cache, signal.cache);
      if ((warnings += signal.warnings.length)) {
        let buffer = logger.warningFile(signal.filePath);
        for (const warning of signal.warnings) {
          buffer += logger.warningMessage(warning);
          logger.warningGithub(warning);
        }
        yield buffer + '\n';
      }

      yield logger.runningTurbo(++fileCount, totalFileCount);
    }
  } catch (error) {
    throw logger.externalError('Could not build cache', error);
  }

  try {
    const contents = createCacheContents(cache);
    await writeOutput(destination, contents);
  } catch (error) {
    throw logger.externalError('Something went wrong while writing the cache file', error);
  }

  const documentCount = Object.keys(cache).length;
  if (warnings && opts.failOnWarn) {
    throw logger.warningSummary(warnings, documentCount);
  } else {
    try {
      const contents = JSON.stringify(cache, null, 2);
      await writeOutput(destination, contents);
    } catch (error) {
      throw logger.externalError('Something went wrong while writing the cache file', error);
    }
    yield logger.infoSummary(warnings, documentCount);
  }
}

function createCacheContents(cache: Record<string, string>): string {
  let output = '';
  for (const key in cache) {
    if (output) output += '\n';
    output += `    ${key}:\n      ${cache[key]};`;
  }
  return (
    PREAMBLE_IGNORE +
    "import type { TadaDocumentNode, $tada } from 'gql.tada';\n\n" +
    "declare module 'gql.tada' {\n" +
    ' interface setupCache {\n' +
    output +
    '\n  }' +
    '\n}\n'
  );
}
