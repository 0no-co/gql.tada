import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseJsonText, convertToObject } from 'typescript';
import { stat, FileType } from './fs';

const jsonParse = async (fileName: string): Promise<unknown> => {
  const contents = await fs.readFile(fileName, 'utf8');
  const sourceFile = parseJsonText(fileName, contents);
  return convertToObject(sourceFile, []);
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

/** Loads suggested settings of in-repo VSCode */
export const loadSuggestedSettings = async (
  targetPath?: string
): Promise<Record<string, unknown> | null> => {
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
  const configFile = path.resolve(target, '.vscode', 'settings.json');
  if (!(await stat(configFile))) return null;
  try {
    const json = await jsonParse(configFile);
    return json && typeof json === 'object' ? (json as Record<string, unknown>) : null;
  } catch (_error) {
    return null;
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
