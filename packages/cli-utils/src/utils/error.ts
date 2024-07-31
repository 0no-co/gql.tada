export const enum TadaErrorCode {
  VUE_SUPPORT,
  SVELTE_SUPPORT,
  UNKNOWN_EXTERNAL_FILE,
}

export class TadaError extends Error {
  static isTadaError(error: unknown): error is TadaError {
    return !!(typeof error === 'object' && error && 'name' in error && error.name === 'TadaError');
  }

  readonly code: TadaErrorCode;
  constructor(code: TadaErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'TadaError';
  }
}
