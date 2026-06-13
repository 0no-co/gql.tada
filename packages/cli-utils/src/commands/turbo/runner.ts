import * as path from 'node:path';

import type { TTY, ComposeInput } from '../../term';
import type { ProjectContext, WriteTarget } from '../shared';
import { loadProjects, writeOutput } from '../shared';
import type { TurboDocument, GraphQLSourceFile, TurboPath } from './types';
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
}

export async function* run(tty: TTY, opts: TurboOptions): AsyncIterable<ComposeInput> {
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
            '"tadaTurboLocation"'
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

/** Runs the turbo cache generation for a single project. */
async function* runProject(
  tty: TTY,
  opts: TurboOptions,
  project: ProjectContext,
  deferWarnings: boolean
): AsyncGenerator<ComposeInput, ProjectResult> {
  const { runTurbo } = await import('./thread');

  const { pluginConfig, projectPath } = project;

  let destination: WriteTarget;
  const destinations: TurboPath[] = [];
  if ('schema' in pluginConfig) {
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
            `You have to either set ${logger.code('"tadaTurboLocation"')} in your configuration,\n` +
              `pass an ${logger.code('--output')} argument to this command,\n` +
              'or pipe this command to an output file.'
          )
      );
    }
  } else if ('schemas' in pluginConfig) {
    for (const schemaConfig of pluginConfig.schemas) {
      if (schemaConfig.tadaTurboLocation)
        destinations.push({
          path: path.resolve(projectPath, schemaConfig.tadaTurboLocation),
          schemaName: schemaConfig.name,
        });
    }
  }

  const generator = runTurbo({
    rootPath: project.configResult.rootPath,
    tsconfigPath: project.configResult.tsconfigPath,
    configPath: project.configResult.configPath,
    pluginConfig,
    turboOutputPath: typeof destination! === 'string' ? destination : destinations,
  });

  const documents: TurboDocument[] = [];
  let graphqlSources: GraphQLSourceFile[] = [];
  let warnings = 0;
  let totalFileCount = 0;
  let fileCount = 0;
  let cachedDocumentCount = 0;

  try {
    if (tty.isInteractive) yield logger.runningTurbo();

    for await (const signal of generator) {
      if (signal.kind === 'EXTERNAL_WARNING') {
        yield logger.experimentMessage(
          `${logger.code('.vue')} and ${logger.code('.svelte')} file support is experimental.`
        );
      } else if (signal.kind === 'FILE_COUNT') {
        totalFileCount = signal.fileCount;
      } else if (signal.kind === 'GRAPHQL_SOURCES') {
        graphqlSources = signal.sources;
      } else {
        fileCount++;
        documents.push(...signal.documents);
        cachedDocumentCount += signal.documents.filter((document) => document.isCached).length;
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

  if ('schema' in pluginConfig) {
    if (warnings && opts.failOnWarn) {
      if (!deferWarnings) throw logger.warningSummary(warnings);
      return { warnings, failed: true };
    }

    try {
      const contents = createCacheContents(documents, graphqlSources, destination!);
      await writeOutput(destination!, contents);
    } catch (error) {
      throw logger.externalError('Something went wrong while writing the type cache file', error);
    }

    yield logger.infoSummary(warnings, documents.length, cachedDocumentCount);
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
    const cachedCount: Record<string, number> = {};
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
        cachedCount[name] = 0;
        const cache: TurboDocument[] = [];
        for (const item of documents) {
          if (item.schemaName === name) {
            cache.push(item);
            documentCount[name]++;
            if (item.isCached) cachedCount[name]++;
          }
        }
        const destination = path.resolve(projectPath, tadaTurboLocation);
        const contents = createCacheContents(cache, graphqlSources, destination);
        await writeOutput(destination, contents);
      } catch (error) {
        throw logger.externalError(
          `Something went wrong while writing the '${name}' schema's type cache file.`,
          error
        );
      }
    }

    if (warnings && opts.failOnWarn) {
      if (!deferWarnings) throw logger.warningSummary(warnings);
      return { warnings, failed: true };
    } else {
      yield logger.infoSummary(warnings, documentCount, cachedCount);
    }
  }

  return { warnings, failed: false };
}

function createCacheContents(
  cache: TurboDocument[],
  graphqlSources: GraphQLSourceFile[],
  turboDestination: WriteTarget
): string {
  const documentsByKey = new Map<string, TurboDocument>();
  for (const document of cache) documentsByKey.set(document.argumentKey, document);

  let output = '';
  for (const document of documentsByKey.values()) {
    if (output) output += '\n';
    if (document.documentHash) output += `    /** @gql.tada/hash ${document.documentHash} */\n`;
    output += `    ${document.argumentKey}:\n      ${document.documentType};`;
  }

  let imports = "import type { TadaDocumentNode, $tada } from 'gql.tada';\n";

  const isFilePath =
    typeof turboDestination === 'string' ||
    (turboDestination &&
      typeof turboDestination === 'object' &&
      'toString' in turboDestination &&
      !('writable' in turboDestination));

  const addedImports = new Set<string>();
  for (const source of graphqlSources) {
    for (const importInfo of source.imports) {
      if (isFilePath) {
        const turboPath = turboDestination.toString();
        const sourceDir = path.dirname(source.absolutePath);
        const absoluteImportPath = path.resolve(sourceDir, importInfo.specifier);
        const absoluteTurboPath = path.resolve(turboPath);

        if (absoluteImportPath === absoluteTurboPath || addedImports.has(importInfo.specifier))
          continue;

        addedImports.add(importInfo.specifier);
      }

      imports += importInfo.importClause + '\n';
    }
  }

  return (
    PREAMBLE_IGNORE +
    imports +
    '\n' +
    "declare module 'gql.tada' {\n" +
    ' interface setupCache {\n' +
    output +
    '\n  }' +
    '\n}\n'
  );
}
