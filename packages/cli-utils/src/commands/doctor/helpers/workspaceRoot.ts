import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { stat, FileType } from './fs';

export const findWorkspaceRoot = async (targetPath?: string): Promise<string | null> => {
  let target = targetPath || process.cwd();
  const rootPath = path.resolve(target, '/');
  while (target !== rootPath) {
    if (await stat(path.resolve(target, '.git'), FileType.Directory)) {
      return target;
    } else if (await stat(path.resolve(target, '.vscode'), FileType.Directory)) {
      return target;
    } else if (await stat(path.resolve(target, 'pnpm-workspace.yml'))) {
      return target;
    }
    const packageJsonPath = path.resolve(target, 'package.json');
    if (await stat(packageJsonPath)) {
      try {
        const meta = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        if (meta && typeof meta === 'object' && Array.isArray(meta.workspaces)) {
          return target;
        }
      } catch (_error) {}
    }
    target = path.resolve(target, '..');
  }
  return null;
};
