import * as path from 'node:path';

import type { TTY, ComposeInput } from '../../term';
import type { ProjectContext, WriteTarget } from '../shared';
import { loadProjects, writeOutput } from '../shared';
import type { PersistedDocument } from './types';
import * as logger from './logger';

export interface PersistedOptions {
  /** Whether to disable normalization of GraphQL documents in the output.
   * @defaultValue `false`
   * @remarks
   * Normalizing a GraphQL document means to parse then print them, which
   * removes comments and normalizes formatting.
   */
  disableNormalization?: boolean;
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
  let projects: ProjectContext[];
  try {
    projects = await loadProjects(opts.tsconfig);
  } catch (error) {
    throw logger.externalError('Failed to load configuration.', error);
  }

  if (projects.length > 1 && (opts.output || tty.pipeTo)) {
    throw logger.errorMessage(
      'Output path was specified, while multiple projects are configured.\n' +
        logger.hint(
          `You can only output all projects to their ${logger.code(
            '"tadaPersistedLocation"'
          )} options\n` +
            `when multiple projects are set up through ${logger.code('"references"')}.`
        )
    );
  }

  let totalWarnings = 0;
  let failedProjects = false;
  for (const project of projects) {
    if (projects.length > 1) yield logger.projectHeader(project.label);
    const result = yield* runProject(tty, opts, project, projects.length > 1);
    totalWarnings += result.warnings;
    failedProjects = failedProjects || result.failed;
  }

  if (failedProjects) {
    throw logger.warningSummary(totalWarnings);
  }
}

interface ProjectResult {
  warnings: number;
  failed: boolean;
}

/** Generates the persisted manifest for a single project. */
async function* runProject(
  tty: TTY,
  opts: PersistedOptions,
  project: ProjectContext,
  deferWarnings: boolean
): AsyncGenerator<ComposeInput, ProjectResult> {
  const { runPersisted } = await import('./thread');

  const { pluginConfig, projectPath } = project;

  if (tty.isInteractive) yield logger.runningPersisted();

  const generator = runPersisted({
    disableNormalization: !!opts.disableNormalization,
    rootPath: project.configResult.rootPath,
    tsconfigPath: project.configResult.tsconfigPath,
    configPath: project.configResult.configPath,
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

  if ('schema' in pluginConfig) {
    let destination: WriteTarget;
    if (!opts.output && tty.pipeTo) {
      destination = tty.pipeTo;
    } else if (opts.output) {
      destination = path.resolve(process.cwd(), opts.output);
    } else if (pluginConfig.tadaPersistedLocation) {
      destination = path.resolve(projectPath, pluginConfig.tadaPersistedLocation);
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
      if (!deferWarnings) throw logger.warningSummary(warnings);
      return { warnings, failed: true };
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
          if (item.schemaName === name) {
            json[item.hashKey] = item.document;
            documentCount[name]++;
          }
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
      if (!deferWarnings) throw logger.warningSummary(warnings);
      return { warnings, failed: true };
    } else {
      yield logger.infoSummary(warnings, documentCount);
    }
  }

  return { warnings, failed: false };
}
