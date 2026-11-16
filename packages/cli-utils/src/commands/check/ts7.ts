import type { CompilerName } from '../shared/compiler';

import type { Severity, DiagnosticMessage, DiagnosticSignal } from './types';

export type { CompilerName };
export { detectCompiler } from '../shared/compiler';

export interface TS7DiagnosticsParams {
  /** The project's own `tsconfig.json`. */
  tsconfigPath: string;
  compiler: CompilerName;
  /** Whether to run the project's content mappers, like `tsc --runExternalCode`. */
  runExternalCode?: boolean;
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
  runExternalCode?: boolean;
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
    runExternalCode: params.runExternalCode,
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
