import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

import type { Severity, DiagnosticMessage, DiagnosticSignal } from './types';

export type CompilerName = 'typescript' | 'tsrs';

export interface DetectCompilerParams {
  rootPath: string;
  tsconfigPath?: string;
  compiler?: CompilerName;
}

const resolvePackageJson = (name: string, fromPath: string): any | null => {
  try {
    const require = createRequire(path.join(fromPath, 'noop.js'));
    return JSON.parse(fs.readFileSync(require.resolve(`${name}/package.json`), 'utf8'));
  } catch {
    return null;
  }
};

/** Determines whether a project is checked on the TypeScript 7.1 API rather than with the compiler API.
 *
 * @remarks
 * TypeScript 7 doesn't expose the compiler API and doesn't load language service
 * plugins, so `@0no-co/graphqlsp`'s diagnostics are run on its programmatic API
 * instead. This is the case when `typescript@>=7` is installed, tsrs is requested,
 * or only tsrs is installed.
 */
export const detectCompiler = (params: DetectCompilerParams): CompilerName | null => {
  const fromPath = params.tsconfigPath ? path.dirname(params.tsconfigPath) : params.rootPath;
  if (params.compiler === 'tsrs') return 'tsrs';
  const typescript = resolvePackageJson('typescript', fromPath);
  if (typescript) {
    const major = parseInt(`${typescript.version}`.split('.')[0], 10);
    return major >= 7 ? 'typescript' : null;
  } else if (params.compiler !== 'typescript' && resolvePackageJson('tsrs', fromPath)) {
    return 'tsrs';
  }
  return null;
};

export interface TS7DiagnosticsParams {
  /** The project's own `tsconfig.json`. */
  tsconfigPath: string;
  compiler: CompilerName;
}

interface CheckDiagnostic {
  file: string;
  start: number;
  length: number;
  line: number;
  column: number;
  message: string;
  code: number;
  severity: 'error' | 'warning' | 'suggestion' | 'message';
}

interface CheckProjectResult {
  files: string[];
  diagnostics: CheckDiagnostic[];
}

type CheckProject = (options: {
  tsconfigPath: string;
  compiler?: CompilerName;
}) => Promise<CheckProjectResult>;

const toSeverity = (severity: CheckDiagnostic['severity']): Severity => {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warn';
    default:
      return 'info';
  }
};

const loadCheckProject = async (): Promise<CheckProject> => {
  let mod: any;
  try {
    // NOTE: The specifier is held in a variable, so it's not bundled or resolved eagerly
    const specifier = '@0no-co/graphqlsp/check';
    mod = await import(specifier);
  } catch (error) {
    throw new Error(
      'Checking projects on TypeScript 7 requires `@0no-co/graphqlsp@>=1.18.0`, which provides `@0no-co/graphqlsp/check`.',
      { cause: error }
    );
  }
  const checkProject = mod.checkProject || (mod.default && mod.default.checkProject);
  if (typeof checkProject !== 'function') {
    throw new Error('`@0no-co/graphqlsp/check` does not export `checkProject`.');
  }
  return checkProject;
};

/** Runs GraphQLSP's diagnostics on the TypeScript 7.1 API (`typescript@>=7.1` or tsrs). */
export async function* runTS7Diagnostics(
  params: TS7DiagnosticsParams
): AsyncIterableIterator<DiagnosticSignal> {
  const checkProject = await loadCheckProject();
  const result = await checkProject({
    tsconfigPath: params.tsconfigPath,
    compiler: params.compiler,
  });

  yield { kind: 'FILE_COUNT', fileCount: result.files.length };

  const messagesByFile = new Map<string, DiagnosticMessage[]>();
  for (const file of result.files) messagesByFile.set(file, []);
  for (const diagnostic of result.diagnostics) {
    let messages = messagesByFile.get(diagnostic.file);
    if (!messages) messagesByFile.set(diagnostic.file, (messages = []));
    messages.push({
      severity: toSeverity(diagnostic.severity),
      message: diagnostic.message,
      file: diagnostic.file,
      line: diagnostic.line,
      col: diagnostic.column,
      endLine: undefined,
      endColumn: undefined,
    });
  }

  for (const [filePath, messages] of messagesByFile)
    yield { kind: 'FILE_DIAGNOSTICS', filePath, messages };
}
