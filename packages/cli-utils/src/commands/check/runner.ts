import path from 'node:path';

import { getGraphQLSPConfig } from '../../lsp';
import { getTsConfig } from '../../tsconfig';
import * as logger from './logger';

type Severity = 'error' | 'warn' | 'info';
const severities: Severity[] = ['error', 'warn', 'info'];

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

  const generator = runDiagnostics({ tsconfigPath, config });

  for await (const signal of generator) {
    if (signal.messages.length) {
      yield logger.diagnosticFile(signal.filePath, signal.messages);
    }
  }
}
