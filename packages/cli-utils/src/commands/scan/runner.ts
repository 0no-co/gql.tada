import * as path from 'node:path';
import type { GraphQLSchema } from 'graphql';
import { loadRef } from '@gql.tada/internal';

import type { TTY, ComposeInput } from '../../term';
import type { ProjectContext, WriteTarget } from '../shared';
import { loadProjects, writeOutput } from '../shared';

import type { SchemaName, RawScanDocument, ScanWarning } from './types';
import { analyze } from './analyze';
import { renderJson } from './output/json';
import { renderTerminalReport } from './output/terminal';
import * as logger from './logger';

export type ScanFormat = 'json';

export interface ScanOptions {
  /** The `tsconfig.json` to use for configurations and the TypeScript program. */
  tsconfig: string | undefined;
  /** When `json`, write the JSON report; otherwise show the terminal report. */
  format: ScanFormat | undefined;
  /** Where to write the JSON report to. Defaults to the piped output. */
  output: string | undefined;
  /** Whether to fail with a non-zero exit code if any warnings are reported. */
  failOnWarn: boolean;
}

async function loadSchemas(project: ProjectContext): Promise<Map<SchemaName, GraphQLSchema>> {
  const ref = await loadRef(project.pluginConfig).load({ rootPath: project.projectPath });
  const schemas = new Map<SchemaName, GraphQLSchema>();
  if (ref.current) schemas.set(null, ref.current.schema);
  for (const name in ref.multi) {
    const result = ref.multi[name];
    if (result) schemas.set(name, result.schema);
  }
  return schemas;
}

export async function* run(tty: TTY, opts: ScanOptions): AsyncIterable<ComposeInput> {
  if (opts.format && opts.format !== 'json') {
    throw logger.errorMessage(
      `Unknown ${logger.code('--format')} '${opts.format}'.\n` +
        logger.hint(`The only supported format is ${logger.code('json')}.`)
    );
  }

  let projects: ProjectContext[];
  try {
    projects = await loadProjects(opts.tsconfig);
  } catch (error) {
    throw logger.externalError('Failed to load configuration.', error);
  }

  if (projects.length > 1 && opts.format && (opts.output || tty.pipeTo)) {
    throw logger.errorMessage(
      'Output path was specified, while multiple projects are configured.\n' +
        logger.hint(
          'The JSON report can only target a single project.\n' +
            `Run scan per-project with an explicit ${logger.code('--tsconfig')}.`
        )
    );
  }

  let totalWarnings = 0;
  for (const project of projects) {
    if (projects.length > 1) yield logger.projectHeader(project.label);
    totalWarnings += yield* runProject(tty, opts, project);
  }

  if (opts.failOnWarn && totalWarnings) {
    throw logger.warningSummary(totalWarnings);
  }
}

async function* runProject(
  tty: TTY,
  opts: ScanOptions,
  project: ProjectContext
): AsyncGenerator<ComposeInput, number> {
  const { runScan } = await import('./thread');

  let schemas: Map<SchemaName, GraphQLSchema>;
  try {
    schemas = await loadSchemas(project);
  } catch (error) {
    throw logger.externalError('Failed to load schema.', error);
  }

  const generator = runScan({
    rootPath: project.configResult.rootPath,
    tsconfigPath: project.configResult.tsconfigPath,
    configPath: project.configResult.configPath,
    pluginConfig: project.pluginConfig,
  });

  const documents: RawScanDocument[] = [];
  const imports = new Map<string, string[]>();
  const warnings: ScanWarning[] = [];
  let totalFileCount = 0;
  let fileCount = 0;

  try {
    if (tty.isInteractive) yield logger.runningScan();

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
        if (signal.imports.length) imports.set(signal.filePath, signal.imports);
        if (signal.warnings.length) {
          warnings.push(...signal.warnings);
          let buffer = logger.warningFile(signal.filePath);
          for (const warning of signal.warnings) {
            buffer += logger.warningMessage(warning);
            logger.warningGithub(warning);
          }
          yield buffer + '\n';
        }
      }

      if (tty.isInteractive) yield logger.runningScan(fileCount, totalFileCount);
    }
  } catch (error) {
    throw logger.externalError('Could not scan files', error);
  }

  // Both outputs render from the same analysis result (corpus + rule datapoints).
  const { context, rules } = analyze({ documents, schemas, imports, warnings });
  const corpus = context.toCorpus();

  if (opts.format === 'json') {
    yield* writeJson(tty, opts, () => renderJson(corpus, rules));
  } else {
    yield renderTerminalReport(corpus, rules);
  }

  yield logger.summary({
    warnings: corpus.warnings.length,
    operations: corpus.operations.length,
    fragments: corpus.fragments.length,
    modules: corpus.modules.length,
  });

  return corpus.warnings.length;
}

async function* writeJson(
  tty: TTY,
  opts: ScanOptions,
  render: () => string
): AsyncGenerator<ComposeInput, void> {
  let destination: WriteTarget;
  if (opts.output) {
    destination = path.resolve(process.cwd(), opts.output);
  } else if (tty.pipeTo) {
    destination = tty.pipeTo;
  } else {
    throw logger.errorMessage(
      'No output path was specified to write the JSON report to.\n' +
        logger.hint(
          `Pass an ${logger.code('--output')} argument to this command,\n` +
            'or pipe this command to an output file.'
        )
    );
  }

  try {
    await writeOutput(destination, render());
  } catch (error) {
    throw logger.externalError('Something went wrong while writing the JSON report', error);
  }

  if (typeof destination === 'string') yield logger.wroteOutput('JSON report', destination);
}
