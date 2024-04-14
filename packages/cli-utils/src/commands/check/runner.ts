import path from 'node:path';

import { getGraphQLSPConfig } from '../../lsp';
import { getTsConfig } from '../../tsconfig';
import * as logger from './logger';

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

export async function* run(opts: Options) {
  const CWD = process.cwd();
  const { runDiagnostics } = await import('./thread');

  const tsconfig = await getTsConfig(opts.tsconfig);
  if (!tsconfig) {
    return;
  }

  const config = getGraphQLSPConfig(tsconfig);
  if (!config) {
    return;
  }

  let tsconfigPath = opts.tsconfig || CWD;
  tsconfigPath =
    path.extname(tsconfigPath) !== '.json'
      ? path.resolve(CWD, tsconfigPath, 'tsconfig.json')
      : path.resolve(CWD, tsconfigPath);

  const summary: SeveritySummary = { warn: 0, error: 0, info: 0 };
  const minSeverity = opts.minSeverity;
  const generator = runDiagnostics({ tsconfigPath, config });

  let totalFileCount = 0;
  let fileCount = 0;

  for await (const signal of generator) {
    if (signal.kind === 'FILE_COUNT') {
      totalFileCount = signal.fileCount;
      continue;
    }

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

    yield logger.runningDiagnostics(++fileCount, totalFileCount);
  }

  // Reset notice count if it's outside of min severity
  if (minSeverity !== 'info') summary.info = 0;

  if ((opts.failOnWarn && summary.warn) || summary.error) {
    throw logger.problemsSummary(summary);
  } else {
    yield logger.infoSummary(summary);
  }
}
