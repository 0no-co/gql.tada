import type { Diagnostic } from 'typescript';

export class TSError extends Error {
  diagnostics: readonly Diagnostic[];
  constructor(message: string, diagnostics?: readonly Diagnostic[]) {
    super(message);
    this.name = 'TSError';
    this.diagnostics = diagnostics || [];
  }
}

export class TadaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TadaError';
  }
}
