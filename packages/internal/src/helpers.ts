import * as path from 'node:path';

export const cwd = process.cwd();

export const maybeRelative = (filePath: string): string => {
  const relative = path.relative(cwd, filePath);
  return !relative.startsWith('..') ? relative : filePath;
};
