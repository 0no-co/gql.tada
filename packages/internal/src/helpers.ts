import * as path from 'node:path';

export const cwd = process.cwd();

export const maybeRelative = (filePath: string): string => {
  const relative = path.relative(cwd, filePath);
  return !relative.startsWith('..') ? relative : filePath;
};

export const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(`${error}`);
