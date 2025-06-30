import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import ts from 'typescript';
import { stat, FileType } from './fs';

const jsonParse = async (fileName: string): Promise<unknown> => {
  const contents = await fs.readFile(fileName, 'utf8');
  const sourceFile = ts.parseJsonText(fileName, contents);
  return ts.convertToObject(sourceFile, []);
};

export const isVSCodeInstalled = async (): Promise<boolean> => {
  if (!process.env.HOME) return false;
  const vscodeFolder = path.resolve(process.env.HOME, '.vscode');
  return !!(await stat(vscodeFolder, FileType.Directory));
};

/** Loads list of suggested in-repo VSCode extensions */
export const loadSuggestedExtensionsList = async (
  targetPath?: string
): Promise<readonly string[]> => {
  let target = targetPath || process.cwd();
  const rootPath = path.resolve(target, '/');
  while (target !== rootPath) {
    if (await stat(path.resolve(target, '.git'), FileType.Directory)) {
      break;
    } else if (await stat(path.resolve(target, '.vscode'), FileType.Directory)) {
      break;
    }
    target = path.resolve(target, '..');
  }
  const configFile = path.resolve(target, '.vscode', 'extensions.json');
  if (!(await stat(configFile))) return [];
  let json: unknown;
  try {
    json = await jsonParse(configFile);
  } catch (_error) {
    return [];
  }
  if (json && typeof json === 'object' && 'recommendations' in json) {
    return Array.isArray(json.recommendations)
      ? json.recommendations
          .filter((x): x is string => x && typeof x === 'string')
          .map((x) => `${x}`.toLowerCase())
      : [];
  } else {
    return [];
  }
};

/** Loads list of installed VSCode extensions */
export const loadExtensionsList = async (): Promise<readonly string[]> => {
  if (!process.env.HOME) return [];
  const vscodeFolder = path.resolve(process.env.HOME, '.vscode');
  const configFile = path.resolve(vscodeFolder, 'extensions', 'extensions.json');
  if (!(await stat(configFile))) return [];
  let json: unknown;
  try {
    json = await jsonParse(configFile);
  } catch (_error) {
    return [];
  }
  return (Array.isArray(json) ? json : [])
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || !('identifier' in entry)) return null;
      if (!entry.identifier || typeof entry.identifier !== 'object' || !('id' in entry.identifier))
        return null;
      return entry.identifier.id && typeof entry.identifier.id === 'string'
        ? `${entry.identifier.id}`.toLowerCase()
        : null;
    })
    .filter((x): x is string => !!x);
};

/** Load the global VSCode settings */
export const loadGlobalSettings = async (): Promise<{ path: string; json: object } | undefined> => {
  if (!process.env.HOME) return undefined;
  const globalPath =
    process.platform === 'darwin'
      ? path.resolve(
          process.env.HOME,
          'Library',
          'Application Support',
          'Code',
          'User',
          'settings.json'
        )
      : path.resolve(process.env.HOME, '.config', 'Code', 'User', 'settings.json');
  try {
    const globalJson = await jsonParse(globalPath);
    if (globalJson && typeof globalJson === 'object') {
      return { path: globalPath, json: globalJson };
    }
  } catch {}
  return undefined;
};

/** Load the workspace VSCode settings */
export const loadWorkspaceSettings = async (
  targetPath?: string
): Promise<{ path: string; json: unknown } | undefined> => {
  if (!process.env.HOME) return undefined;
  let current = targetPath || process.cwd();
  const root = path.parse(current).root;
  while (current !== root) {
    const settingsPath = path.resolve(current, '.vscode', 'settings.json');
    if (await stat(settingsPath, FileType.File)) {
      try {
        const workspaceJson = await jsonParse(settingsPath);
        return { path: settingsPath, json: workspaceJson };
      } catch {}
      break;
    }
    current = path.dirname(current);
  }
  return undefined;
};

/** Load all VSCode settings */
export const loadSettings = async (
  targetPath?: string
): Promise<{
  workspace?: { path: string; json: unknown };
  global?: { path: string; json: unknown };
}> => {
  return {
    workspace: await loadWorkspaceSettings(targetPath),
    global: await loadGlobalSettings(),
  };
};
