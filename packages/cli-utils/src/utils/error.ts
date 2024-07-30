export class TadaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TadaError';
  }
}
