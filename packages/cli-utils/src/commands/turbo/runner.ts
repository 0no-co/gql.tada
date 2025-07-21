import * as path from 'node:path';
import type { GraphQLSPConfig, LoadConfigResult } from '@gql.tada/internal';

import { loadConfig, parseConfig } from '@gql.tada/internal';

import type { TTY, ComposeInput } from '../../term';
import type { WriteTarget } from '../shared';
import { writeOutput } from '../shared';
import type { TurboDocument } from './types';
import { ChangeDetector } from './change-detection';
import * as logger from './logger';

const PREAMBLE_IGNORE = ['/* eslint-disable */', '/* prettier-ignore */'].join('\n') + '\n';

export interface TurboOptions {
  /** Whether to fail instead of just logging a warning. */
  failOnWarn: boolean;
  /** The `tsconfig.json` to use for configurations and the TypeScript program.
   * @defaultValue A `tsconfig.json` in the current or any parent directory. */
  tsconfig: string | undefined;
  /** The filename to write the cache file to.
   * @defaultValue The `tadaTurboLocation` configuration option */
  output: string | undefined;
  /** Skip cache regeneration when no GraphQL files have changed */
  skipUnchanged: boolean;
}

export async function* run(tty: TTY, opts: TurboOptions): AsyncIterable<ComposeInput> {
  const { runTurbo } = await import('./thread');

  let configResult: LoadConfigResult;
  let pluginConfig: GraphQLSPConfig;
  try {
    configResult = await loadConfig(opts.tsconfig);
    pluginConfig = parseConfig(configResult.pluginConfig, configResult.rootPath);
  } catch (error) {
    throw logger.externalError('Failed to load configuration.', error);
  }

  // Check if we should skip regeneration due to no changes
  const changeDetector = new ChangeDetector(configResult.rootPath, pluginConfig);
  const changeResult = await changeDetector.shouldSkipRegeneration({
    skipUnchanged: opts.skipUnchanged,
  });

  if (changeResult.shouldSkip) {
    yield logger.skipMessage(changeResult.reason);
    return;
  }

  if (opts.skipUnchanged && !changeResult.shouldSkip) {
    yield logger.regeneratingMessage(changeResult.reason);
  }

  const generator = runTurbo({
    rootPath: configResult.rootPath,
    configPath: configResult.configPath,
    pluginConfig,
  });

  const documents: TurboDocument[] = [];
  let warnings = 0;
  let totalFileCount = 0;
  let fileCount = 0;

  try {
    if (tty.isInteractive) yield logger.runningTurbo();

    for await (const signal of generator) {
      if (signal.kind === 'EXTERNAL_WARNING') {
        yield logger.experimentMessage(
          `${logger.code('.vue')} and ${logger.code('.svelte')} file support is experimental.`
        );
      } else if (signal.kind === 'FILE_COUNT') {
        totalFileCount = signal.fileCount;
      } else {
        fileCount++;
        documents.push(...signal.documents);
        warnings += signal.warnings.length;
        if (signal.warnings.length) {
          let buffer = logger.warningFile(signal.filePath);
          for (const warning of signal.warnings) {
            buffer += logger.warningMessage(warning);
            logger.warningGithub(warning);
          }
          yield buffer + '\n';
        }
      }

      if (tty.isInteractive) yield logger.runningTurbo(fileCount, totalFileCount);
    }
  } catch (error) {
    throw logger.externalError('Could not build cache', error);
  }

  const projectPath = path.dirname(configResult.configPath);
  if ('schema' in pluginConfig) {
    let destination: WriteTarget;
    if (!opts.output && tty.pipeTo) {
      destination = tty.pipeTo;
    } else if (opts.output) {
      destination = path.resolve(process.cwd(), opts.output);
    } else if (pluginConfig.tadaTurboLocation) {
      destination = path.resolve(projectPath, pluginConfig.tadaTurboLocation);
    } else if (pluginConfig.tadaOutputLocation) {
      destination = path.resolve(
        projectPath,
        pluginConfig.tadaOutputLocation,
        '..',
        'graphql-cache.d.ts'
      );
      yield logger.hintMessage(
        'No output location was specified.\n' +
          `The turbo cache will by default be saved as ${logger.code('"graphql-cache.d.ts"')}.\n` +
          logger.hint(
            `To change this, add a ${logger.code('"tadaTurboLocation"')} in your configuration,\n` +
              `pass an ${logger.code('--output')} argument to this command,\n` +
              'or pipe this command to an output file.'
          )
      );
    } else {
      throw logger.errorMessage(
        'No output path was specified to write the output file to.\n' +
          logger.hint(
            `You have to either set ${logger.code(
              '"tadaTurboLocation"'
            )} in your configuration,\n` +
              `pass an ${logger.code('--output')} argument to this command,\n` +
              'or pipe this command to an output file.'
          )
      );
    }

    if (warnings && opts.failOnWarn) {
      throw logger.warningSummary(warnings);
    }

    try {
      const cache: Record<string, string> = {};
      for (const item of documents) cache[item.argumentKey] = item.documentType;
      const contents = createCacheContents(cache);
      await writeOutput(destination, contents);

      // Save state for change detection
      if (opts.skipUnchanged) {
        await changeDetector.saveCurrentState();
      }
    } catch (error) {
      throw logger.externalError('Something went wrong while writing the type cache file', error);
    }

    yield logger.infoSummary(warnings, documents.length);
  } else {
    if (opts.output) {
      throw logger.errorMessage(
        'Output path was specified, while multiple schemas are configured.\n' +
          logger.hint(
            `You can only output all schemas to their ${logger.code(
              '"tadaTurboLocation"'
            )} options\n` + `when multiple ${logger.code('schemas')} are set up.`
          )
      );
    }

    const documentCount: Record<string, number> = {};
    for (const schemaConfig of pluginConfig.schemas) {
      const { name, tadaTurboLocation } = schemaConfig;
      if (!tadaTurboLocation) {
        throw logger.errorMessage(
          `No output path was specified to write the '${name}' type cache to.\n` +
            logger.hint(
              `You have to set ${logger.code('"tadaTurboLocation"')} in each schema configuration.`
            )
        );
      }

      try {
        documentCount[name] = 0;
        const cache: Record<string, string> = {};
        for (const item of documents) {
          if (item.schemaName === name) {
            cache[item.argumentKey] = item.documentType;
            documentCount[name]++;
          }
        }
        const contents = createCacheContents(cache);
        await writeOutput(path.resolve(projectPath, tadaTurboLocation), contents);
      } catch (error) {
        throw logger.externalError(
          `Something went wrong while writing the '${name}' schema's type cache file.`,
          error
        );
      }
    }

    // Save state for change detection after all schemas are processed
    if (opts.skipUnchanged) {
      try {
        await changeDetector.saveCurrentState();
      } catch (error) {
        // Don't fail the entire process if we can't save state
        console.warn('Warning: Failed to save change detection state:', error);
      }
    }

    if (warnings && opts.failOnWarn) {
      throw logger.warningSummary(warnings);
    } else {
      yield logger.infoSummary(warnings, documentCount);
    }
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
