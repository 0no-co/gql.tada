import * as path from 'node:path';
import type { GraphQLSPConfig, LoadConfigResult } from '@gql.tada/internal';

import { loadConfig, parseConfig } from '@gql.tada/internal';

import type { TTY } from '../../term';
import type { WriteTarget } from '../shared';
import { writeOutput } from '../shared';
import * as logger from './logger';

interface Options {
  tsconfig: string | undefined;
  output: string | undefined;
  failOnWarn: boolean;
}

export async function* run(tty: TTY, opts: Options) {
  const { runPersisted } = await import('./thread');

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
  } else if (pluginConfig.tadaPersistedLocation) {
    destination = path.resolve(
      path.dirname(configResult.configPath),
      pluginConfig.tadaPersistedLocation
    );
  } else {
    throw logger.errorMessage(
      'No output path was specified to write the persisted manifest file to.\n' +
        logger.hint(
          `You have to either set ${logger.code(
            '"tadaPersistedLocation"'
          )} in your configuration,\n` +
            `pass an ${logger.code('--output')} argument to this command,\n` +
            'or pipe this command to an output file.'
        )
    );
  }

  let documents: Record<string, string> = {};
  const generator = runPersisted({
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

      documents = Object.assign(documents, signal.documents);
      if ((warnings += signal.warnings.length)) {
        let buffer = logger.warningFile(signal.filePath);
        for (const warning of signal.warnings) {
          buffer += logger.warningMessage(warning);
          logger.warningGithub(warning);
        }
        yield buffer + '\n';
      }

      yield logger.runningPersisted(++fileCount, totalFileCount);
    }
  } catch (error) {
    throw logger.externalError('Could not generate persisted manifest file', error);
  }

  const documentCount = Object.keys(documents).length;
  if (warnings && opts.failOnWarn) {
    throw logger.warningSummary(warnings, documentCount);
  } else {
    if (documentCount) {
      try {
        const contents = JSON.stringify(documents, null, 2);
        await writeOutput(destination, contents);
      } catch (error) {
        throw logger.externalError(
          'Something went wrong while writing the introspection file',
          error
        );
      }
    }
    yield logger.infoSummary(warnings, documentCount);
  }
}
