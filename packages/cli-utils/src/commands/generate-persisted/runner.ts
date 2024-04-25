import * as path from 'node:path';
import type { GraphQLSPConfig, LoadConfigResult } from '@gql.tada/internal';

import { loadConfig, parseConfig } from '@gql.tada/internal';

import type { TTY, ComposeInput } from '../../term';
import type { WriteTarget } from '../shared';
import { writeOutput } from '../shared';
import type { PersistedDocument } from './types';
import * as logger from './logger';

export interface PersistedOptions {
  /** The `tsconfig.json` to use for configurations and the TypeScript program.
   * @defaultValue A `tsconfig.json` in the current or any parent directory. */
  tsconfig: string | undefined;
  /** The filename to write the persisted JSON manifest to.
   * @defaultValue The `schema` configuration option */
  output: string | undefined;
  /** Whether to fail instead of just logging a warning. */
  failOnWarn: boolean;
}

export async function* run(tty: TTY, opts: PersistedOptions): AsyncIterable<ComposeInput> {
  const { runPersisted } = await import('./thread');

  let configResult: LoadConfigResult;
  let pluginConfig: GraphQLSPConfig;
  try {
    configResult = await loadConfig(opts.tsconfig);
    pluginConfig = parseConfig(configResult.pluginConfig, configResult.rootPath);
  } catch (error) {
    throw logger.externalError('Failed to load configuration.', error);
  }

  if (tty.isInteractive) yield logger.runningPersisted();

  const generator = runPersisted({
    rootPath: configResult.rootPath,
    configPath: configResult.configPath,
    pluginConfig,
  });

  const documents: PersistedDocument[] = [];
  let warnings = 0;
  let totalFileCount = 0;
  let fileCount = 0;

  try {
    if (tty.isInteractive) yield logger.runningPersisted();

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

      if (tty.isInteractive) yield logger.runningPersisted(fileCount, totalFileCount);
    }
  } catch (error) {
    throw logger.externalError('Could not generate persisted manifest file', error);
  }

  const projectPath = path.dirname(configResult.configPath);
  if ('schema' in pluginConfig) {
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

    if (warnings && opts.failOnWarn) {
      throw logger.warningSummary(warnings, documents.length);
    } else if (documents.length) {
      try {
        const json: Record<string, string> = {};
        for (const item of documents) json[item.hashKey] = item.document;
        const contents = JSON.stringify(json, null, 2);
        await writeOutput(destination, contents);
      } catch (error) {
        throw logger.externalError(
          'Something went wrong while writing the persisted manifest file.',
          error
        );
      }
    }

    yield logger.infoSummary(warnings, documents.length);
  } else {
    if (opts.output) {
      throw logger.errorMessage(
        'Output path was specified, while multiple schemas are configured.\n' +
          logger.hint(
            `You can only output all schemas to their ${logger.code(
              '"tadaPersistedLocation"'
            )} options\n` + `when multiple ${logger.code('schemas')} are set up.`
          )
      );
    }

    const documentCount: Record<string, number> = {};
    for (const schemaConfig of pluginConfig.schemas) {
      const { name, tadaPersistedLocation } = schemaConfig;
      if (!tadaPersistedLocation) {
        throw logger.errorMessage(
          `No output path was specified to write the '${name}' schema to.\n` +
            logger.hint(
              `You have to set ${logger.code(
                '"tadaPersistedLocation"'
              )} in each schema configuration.`
            )
        );
      }

      try {
        documentCount[name] = 0;
        const json: Record<string, string> = {};
        for (const item of documents) {
          json[item.hashKey] = item.document;
          documentCount[name]++;
        }
        if (documentCount[name]) {
          const contents = JSON.stringify(json, null, 2);
          await writeOutput(path.resolve(projectPath, tadaPersistedLocation), contents);
        }
      } catch (error) {
        throw logger.externalError(
          `Something went wrong while writing the '${name}' schema's persisted manifest file.`,
          error
        );
      }
    }

    if (warnings && opts.failOnWarn) {
      throw logger.warningSummary(warnings, documentCount);
    } else {
      yield logger.infoSummary(warnings, documentCount);
    }
  }
}
