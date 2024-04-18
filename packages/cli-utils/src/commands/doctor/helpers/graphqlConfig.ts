import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { stat, FileType } from './fs';
import { findWorkspaceRoot } from './workspaceRoot';

const configFileRe = /^(?:graphql\.config|\.graphqlrc)\.(?:cjs|[jt]s|json|toml|ya?ml)$/i;

/** Loads list of suggested in-repo VSCode extensions */
export const findGraphQLConfig = async (targetPath?: string): Promise<string | null> => {
  let target = targetPath || process.cwd();
  const rootPath = path.resolve(target, '/');
  while (target !== rootPath) {
    let dir: readonly string[] = [];
    try {
      dir = await fs.readdir(target);
    } catch (_error) {}
    const configFile = dir.find((item) => configFileRe.test(item));
    if (configFile) return configFile;
    if (await stat(path.resolve(target, '.git'), FileType.Directory)) {
      break;
    } else if (await stat(path.resolve(target, '.vscode'), FileType.Directory)) {
      break;
    }
    target = path.resolve(target, '..');
  }

  const workspaceRoot = await findWorkspaceRoot(targetPath);
  if (workspaceRoot) {
    const packageJsonPath = path.resolve(workspaceRoot, 'package.json');
    if (await stat(packageJsonPath)) {
      try {
        const meta = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        if (
          meta &&
          typeof meta === 'object' &&
          'graphql' in meta &&
          meta.graphql &&
          typeof meta.graphql === 'object'
        ) {
          return packageJsonPath;
        }
      } catch (_error) {}
    }
  }

  return null;
};
