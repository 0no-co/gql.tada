import * as path from 'node:path';

export function shouldScanTurboFile(fileName: string, turboOutputPaths: Set<string>): boolean {
  if (turboOutputPaths.has(path.resolve(fileName))) return false;
  if (fileName.endsWith('.d.ts') || fileName.endsWith('.d.mts') || fileName.endsWith('.d.cts')) {
    return false;
  }
  return !/(^|[/\\])node_modules([/\\]|$)/.test(fileName);
}
