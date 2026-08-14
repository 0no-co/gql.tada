import * as path from 'node:path';

import * as logger from './logger';
import type { TTY, ComposeInput } from '../../term';
import type { ProjectContext } from '../shared';
import { loadProjects } from '../shared';
import type { DiagnosticMessage, Severity, SeveritySummary } from './types';
import { displayPath } from '../shared/machine';

export interface CheckJsonDiagnostic {
  severity: Severity;
  message: string;
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface CheckResult {
  projects: Array<{ label: string; tsconfig: string }>;
  diagnostics: CheckJsonDiagnostic[];
  summary: SeveritySummary;
}

export const createCheckResult = (): CheckResult => ({
  projects: [],
  diagnostics: [],
  summary: { warn: 0, error: 0, info: 0 },
});

const toJsonDiagnostic = (
  message: DiagnosticMessage,
  projectPath: string
): CheckJsonDiagnostic => ({
  severity: message.severity,
  message: message.message.trim(),
  file: displayPath(message.file, projectPath),
  line: message.line,
  column: message.col,
  ...(message.endLine == null ? {} : { endLine: message.endLine }),
  ...(message.endColumn == null ? {} : { endColumn: message.endColumn }),
});

const isMinSeverity = (severity: Severity, minSeverity: Severity) => {
  switch (severity) {
    case 'info':
      return minSeverity !== 'warn' && minSeverity !== 'error';
    case 'warn':
      return minSeverity !== 'error';
    case 'error':
      return true;
  }
};

export interface FormattedDisplayableDiagnostic {
  severity: Severity;
  message: string;
  line: number;
  col: number;
  file: string | undefined;
}

export interface Options {
  failOnWarn: boolean | undefined;
  minSeverity: Severity;
  tsconfig: string | undefined;
  /** Suppresses human-only side effects while collecting structured output. */
  machine?: boolean;
  /** Working directory captured when the command starts, for stable relative paths. */
  cwd?: string;
  /** Optional result sink used by the machine-readable command path. */
  result?: CheckResult;
}

export async function* run(tty: TTY, opts: Options): AsyncIterable<ComposeInput> {
  const { runDiagnostics } = await import('./thread');

  let projects: ProjectContext[];
  try {
    projects = await loadProjects(opts.tsconfig);
  } catch (error) {
    throw logger.externalError('Failed to load configuration.', error);
  }

  const summary: SeveritySummary = opts.result?.summary ?? { warn: 0, error: 0, info: 0 };
  const minSeverity = opts.minSeverity;
  let warnedAboutExternalFiles = false;

  for (const project of projects) {
    opts.result?.projects.push({
      label: project.label,
      tsconfig: displayPath(project.configResult.tsconfigPath, opts.cwd),
    });
    if (projects.length > 1 && !opts.machine) yield logger.projectHeader(project.label);

    const generator = runDiagnostics({
      rootPath: project.configResult.rootPath,
      tsconfigPath: project.configResult.tsconfigPath,
      configPath: project.configResult.configPath,
      pluginConfig: project.pluginConfig,
    });

    let totalFileCount = 0;
    let fileCount = 0;

    try {
      if (tty.isInteractive) yield logger.runningDiagnostics();

      for await (const signal of generator) {
        if (signal.kind === 'EXTERNAL_WARNING') {
          if (!warnedAboutExternalFiles) {
            warnedAboutExternalFiles = true;
            if (!opts.machine) {
              yield logger.experimentMessage(
                `${logger.code('.vue')} and ${logger.code('.svelte')} file support is experimental.`
              );
            }
          }
        } else if (signal.kind === 'FILE_COUNT') {
          totalFileCount = signal.fileCount;
        } else {
          fileCount++;
          let buffer = '';
          for (const message of signal.messages) {
            summary[message.severity]++;
            if (isMinSeverity(message.severity, minSeverity)) {
              opts.result?.diagnostics.push(
                toJsonDiagnostic(
                  message,
                  path.isAbsolute(project.configResult.tsconfigPath)
                    ? path.dirname(project.configResult.tsconfigPath)
                    : opts.cwd || process.cwd()
                )
              );
              if (!opts.machine) {
                buffer += logger.diagnosticMessage(message);
                logger.diagnosticMessageGithub(message);
              }
            }
          }
          if (buffer && !opts.machine) {
            yield logger.diagnosticFile(signal.filePath) + buffer + '\n';
          }
        }

        if (tty.isInteractive) yield logger.runningDiagnostics(fileCount, totalFileCount);
      }
    } catch (error: any) {
      throw logger.externalError('Could not check files', error);
    }
  }

  // Reset notice count if it's outside of min severity
  if (minSeverity !== 'info') summary.info = 0;

  if ((opts.failOnWarn && summary.warn) || summary.error) {
    throw logger.problemsSummary(summary);
  } else if (!opts.machine) {
    yield logger.infoSummary(summary);
  }
}
