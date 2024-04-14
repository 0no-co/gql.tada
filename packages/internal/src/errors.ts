import type { Diagnostic } from 'typescript';

export class TSError extends Error {
  readonly name: 'TSError';
  readonly diagnostic: Diagnostic;
  constructor(diagnostic: Diagnostic) {
    super(
      typeof diagnostic.messageText !== 'string'
        ? diagnostic.messageText.messageText
        : diagnostic.messageText
    );
    this.name = 'TSError';
    this.diagnostic = diagnostic;
  }
}

export class TadaError extends Error {
  readonly name: 'TadaError';
  constructor(message: string) {
    super(message);
    this.name = 'TadaError';
  }
}
