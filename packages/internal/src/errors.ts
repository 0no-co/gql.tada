import type ts from 'typescript';
import { maybeRelative } from './helpers';

export class TSError extends Error {
  readonly name: 'TSError';
  readonly diagnostic: ts.Diagnostic;
  constructor(diagnostic: ts.Diagnostic) {
    let message =
      typeof diagnostic.messageText !== 'string'
        ? diagnostic.messageText.messageText
        : diagnostic.messageText;
    if (diagnostic.file) message += ` (${maybeRelative(diagnostic.file.fileName)})`;
    super(message);
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
