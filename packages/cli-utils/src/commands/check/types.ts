export type Severity = 'error' | 'warn' | 'info';

export type SeveritySummary = Record<Severity, number>;

export interface DiagnosticMessage {
  severity: Severity;
  message: string;
  file: string;
  line: number;
  col: number;
}

export interface FileDiagnosticsSignal {
  kind: 'FILE_DIAGNOSTICS';
  filePath: string;
  messages: DiagnosticMessage[];
}

export type DiagnosticSignal = FileDiagnosticsSignal;
