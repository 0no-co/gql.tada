export type Severity = 'error' | 'warn' | 'info';

export type SeveritySummary = Record<Severity, number>;

export interface DiagnosticMessage {
  severity: Severity;
  message: string;
  file: string;
  line: number;
  col: number;
  endLine: number | undefined;
  endColumn: number | undefined;
}

export interface FileDiagnosticsSignal {
  kind: 'FILE_DIAGNOSTICS';
  filePath: string;
  messages: DiagnosticMessage[];
}

export interface FileCountSignal {
  kind: 'FILE_COUNT';
  fileCount: number;
}

export type DiagnosticSignal = FileDiagnosticsSignal | FileCountSignal;
