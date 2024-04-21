import type { IScriptSnapshot } from 'typescript';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface ScannedFile {
  fileId: string;
  snapshot: IScriptSnapshot;
}

export async function scanProjectFiles(
  paths: readonly string[],
  predicate: (filepath: string) => boolean,
  ts: typeof import('typescript/lib/tsserverlibrary')
): Promise<readonly ScannedFile[]> {
  const seenPaths = new Set();
  const searchPaths = [...paths];
  const files: ScannedFile[] = [];

  async function _scanVueFile(filepath: string, origpath?: string) {
    const stat = await fs.stat(filepath);
    if (stat.isSymbolicLink()) {
      if (!origpath) await _scanVueFile(await fs.realpath(filepath), filepath);
    } else if (stat.isFile()) {
      if (predicate(origpath || filepath)) {
        const contents = await fs.readFile(filepath, 'utf8');
        files.push({
          fileId: filepath,
          snapshot: ts.ScriptSnapshot.fromString(contents),
        });
      }
    } else if (stat.isDirectory() && !/\bnode_modules\b/.test(filepath)) {
      if (!seenPaths.has(filepath)) searchPaths.push(filepath);
    }
  }

  async function _scanVueFiles(dirpath: string) {
    if (seenPaths.has(dirpath)) return;
    seenPaths.add(dirpath);

    let dir: string[];
    try {
      dir = await fs.readdir(dirpath);
    } catch (_error) {
      return;
    }

    for (const entry of dir) {
      const filepath = path.join(dirpath, entry);
      try {
        await _scanVueFile(filepath);
      } catch (_error) {
        continue;
      }
    }
  }

  let dir: string | undefined;
  while ((dir = searchPaths.shift()) != null) await _scanVueFiles(dir);
  return files;
}
