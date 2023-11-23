import fs from 'node:fs';
import type { Files, FileData } from './virtualHost';
import path from 'node:path/posix';

const virtualRoot = path.resolve(__dirname, '../../../');

export function readFileFromRoot(name: string): FileData {
  return fs.readFileSync(path.join(virtualRoot, name));
}

export function readVirtualModule(moduleName: string): Files {
  const files: Files = {};

  function walk(directory: string) {
    for (const entry of fs.readdirSync(path.resolve(virtualRoot, directory))) {
      const file = path.join(directory, entry);
      const target = path.resolve(virtualRoot, file);
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        walk(file);
      } else {
        files[file] = fs.readFileSync(target).toString();
      }
    }
  }

  walk(path.join('node_modules', moduleName));
  return files;
}
