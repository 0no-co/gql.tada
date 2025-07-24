import * as path from 'node:path';
import type { GraphQLSPConfig, LoadConfigResult } from '@gql.tada/internal';

import { loadConfig, parseConfig } from '@gql.tada/internal';

import type { TTY, ComposeInput } from '../../term';
import type { WriteTarget } from '../shared';
import { writeOutput } from '../shared';
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
  const { runTurbo } = await import('./thread');

  let configResult: LoadConfigResult;
  let pluginConfig: GraphQLSPConfig;
  try {
    configResult = await loadConfig(opts.tsconfig);
    pluginConfig = parseConfig(configResult.pluginConfig, configResult.rootPath);
  } catch (error) {
    throw logger.externalError('Failed to load configuration.', error);
  }
  const projectPath = path.dirname(configResult.configPath);

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
    rootPath: configResult.rootPath,
    configPath: configResult.configPath,
    pluginConfig,
    turboOutputPath: typeof destination! === 'string' ? destination : destinations,
  });

  const documents: TurboDocument[] = [];
  let graphqlSources: GraphQLSourceFile[] = [];
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
      } else if (signal.kind === 'GRAPHQL_SOURCES') {
        graphqlSources = signal.sources;
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

  if ('schema' in pluginConfig) {
    if (warnings && opts.failOnWarn) {
      throw logger.warningSummary(warnings);
    }

    try {
      const cache: Record<string, string> = {};
      for (const item of documents) cache[item.argumentKey] = item.documentType;
      const contents = createCacheContents(cache, graphqlSources, destination!);
      await writeOutput(destination!, contents);
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
      throw logger.warningSummary(warnings);
    } else {
      yield logger.infoSummary(warnings, documentCount);
    }
  }
}

function createCacheContents(
  cache: Record<string, string>,
  graphqlSources: GraphQLSourceFile[],
  turboDestination: WriteTarget
): string {
  let output = '';
  for (const key in cache) {
    if (output) output += '\n';
    output += `    ${key}:\n      ${cache[key]};`;
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
