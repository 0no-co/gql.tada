import * as logger from './logger';
import type { TTY, ComposeInput } from '../../term';
import type { ProjectContext } from '../shared';
import { loadProjects } from '../shared';
import type { Severity, SeveritySummary } from './types';

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
}

export async function* run(tty: TTY, opts: Options): AsyncIterable<ComposeInput> {
  const { runDiagnostics } = await import('./thread');

  let projects: ProjectContext[];
  try {
    projects = await loadProjects(opts.tsconfig);
  } catch (error) {
    throw logger.externalError('Failed to load configuration.', error);
  }

  const summary: SeveritySummary = { warn: 0, error: 0, info: 0 };
  const minSeverity = opts.minSeverity;
  let warnedAboutExternalFiles = false;

  for (const project of projects) {
    if (projects.length > 1) yield logger.projectHeader(project.label);

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
            yield logger.experimentMessage(
              `${logger.code('.vue')} and ${logger.code('.svelte')} file support is experimental.`
            );
          }
        } else if (signal.kind === 'FILE_COUNT') {
          totalFileCount = signal.fileCount;
        } else {
          fileCount++;
          let buffer = '';
          for (const message of signal.messages) {
            summary[message.severity]++;
            if (isMinSeverity(message.severity, minSeverity)) {
              buffer += logger.diagnosticMessage(message);
              logger.diagnosticMessageGithub(message);
            }
          }
          if (buffer) {
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
  } else {
    yield logger.infoSummary(summary);
  }
}
