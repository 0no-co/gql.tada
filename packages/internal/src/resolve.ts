import ts from 'typescript';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { Stats } from 'node:fs';
import type { TsConfigJson } from 'type-fest';

import { cwd, maybeRelative } from './helpers';
import { TSError, TadaError } from './errors';

const TSCONFIG = 'tsconfig.json';

const isFile = (stat: Stats): boolean => stat.isFile();
const isDir = (stat: Stats): boolean => stat.isDirectory();
const stat = (file: string, predicate = isFile): Promise<boolean> =>
  fs
    .stat(file)
    .then(predicate)
    .catch(() => false);

const isMissingFileError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error.code === 'ENOENT' || error.code === 'ENOTDIR');

const _resolve =
  typeof require !== 'undefined'
    ? require.resolve.bind(require)
    : createRequire(import.meta.url).resolve;
const resolveExtend = async (extend: string, from: string) => {
  try {
    return toTSConfigPath(_resolve(extend, { paths: [from] }));
  } catch (_error) {
    return null;
  }
};

const toTSConfigPath = (tsconfigPath: string): string =>
  path.extname(tsconfigPath) !== '.json'
    ? path.resolve(cwd, tsconfigPath, TSCONFIG)
    : path.resolve(cwd, tsconfigPath);

export const readTSConfigFile = async (filePath: string): Promise<TsConfigJson> => {
  const tsconfigPath = toTSConfigPath(filePath);
  const contents = await fs.readFile(tsconfigPath, 'utf8');
  const result = ts.parseConfigFileTextToJson(tsconfigPath, contents);
  if (result.error) throw new TSError(result.error);
  return result.config || {};
};

export const findTSConfigFile = async (targetPath?: string): Promise<string | null> => {
  let tsconfigPath = toTSConfigPath(targetPath || cwd);
  const rootPath = toTSConfigPath(path.resolve(tsconfigPath, '/'));
  while (tsconfigPath !== rootPath) {
    if (await stat(tsconfigPath)) return tsconfigPath;
    const gitPath = path.resolve(tsconfigPath, '..', '.git');
    if (await stat(gitPath, isDir)) return null;
    const parentPath = toTSConfigPath(path.resolve(tsconfigPath, '..', '..'));
    if (parentPath === tsconfigPath) break;
    tsconfigPath = parentPath;
  }
  return null;
};

const getPluginConfig = (tsconfig: TsConfigJson | null): Record<string, unknown> | null =>
  (tsconfig &&
    tsconfig.compilerOptions &&
    tsconfig.compilerOptions.plugins &&
    tsconfig.compilerOptions.plugins.find(
      (x) =>
        x.name === '@0no-co/graphqlsp' ||
        x.name === 'gql.tada/lsp' ||
        x.name === 'gql.tada/ts-plugin'
    )) ||
  null;

/** Mirrors `ts.resolveProjectReferencePath`: a reference path that isn't a
 * `.json` file points at a directory containing a `tsconfig.json` file. */
const resolveReferencePath = (referencePath: string, fromDir: string): string => {
  const resolved = path.resolve(fromDir, referencePath);
  return path.extname(resolved) === '.json' ? resolved : path.join(resolved, TSCONFIG);
};

const toProjectKey = (filePath: string): string => {
  const normalized = path.normalize(filePath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
};

/** A "solution-style" tsconfig only groups referenced projects and contains
 * no files of its own (e.g. the root tsconfig.json of Vite/Vue templates). */
const isSolutionStyleConfig = (tsconfig: TsConfigJson): boolean =>
  Array.isArray(tsconfig.references) &&
  Array.isArray(tsconfig.files) &&
  tsconfig.files.length === 0 &&
  !tsconfig.include;

interface PluginEntryResult {
  pluginConfig: Record<string, unknown>;
  configPath: string;
}

const resolvePluginEntry = async (
  tsconfigPath: string,
  tsconfig: TsConfigJson
): Promise<PluginEntryResult | null> => {
  const pluginConfig = getPluginConfig(tsconfig);
  if (pluginConfig) return { pluginConfig, configPath: tsconfigPath };

  const extendsList = Array.isArray(tsconfig.extends)
    ? tsconfig.extends
    : tsconfig.extends
      ? [tsconfig.extends]
      : [];
  for (let extend of extendsList) {
    if (path.extname(extend) !== '.json') extend += '.json';
    try {
      const extendPath = await resolveExtend(extend, path.dirname(tsconfigPath));
      if (!extendPath) continue;
      const extendConfig = await readTSConfigFile(extendPath);
      const result = await resolvePluginEntry(extendPath, extendConfig);
      if (result) return result;
    } catch (_error) {}
  }

  return null;
};

export interface LoadConfigResult {
  pluginConfig: Record<string, unknown>;
  /** The config file in which the plugin entry was found (may be an `extends` base file). */
  configPath: string;
  /** The project's own tsconfig.json file, before `extends` resolution. */
  tsconfigPath: string;
  rootPath: string;
}

export const loadConfigs = async (targetPath?: string): Promise<LoadConfigResult[]> => {
  const rootTsconfigPath = await findTSConfigFile(targetPath);
  if (!rootTsconfigPath) {
    throw new TadaError(
      targetPath
        ? `No tsconfig.json found at or above: ${maybeRelative(targetPath)}`
        : 'No tsconfig.json found at or above current working directory'
    );
  }

  const visited = new Set<string>();
  const seenEntries = new Set<string>();
  const results: LoadConfigResult[] = [];
  // A solution-style config carrying a plugin entry has no files of its own, so
  // it's only used when no referenced project provides a plugin entry instead
  let solutionFallback: LoadConfigResult | null = null;
  let hasReferences = false;

  const visit = async (tsconfigPath: string, isRoot: boolean): Promise<void> => {
    const projectKey = toProjectKey(tsconfigPath);
    if (visited.has(projectKey)) return;
    visited.add(projectKey);

    let tsconfig: TsConfigJson;
    try {
      tsconfig = await readTSConfigFile(tsconfigPath);
    } catch (error) {
      if (isRoot || !isMissingFileError(error)) throw error;
      return;
    }

    const entry = await resolvePluginEntry(tsconfigPath, tsconfig);
    if (entry) {
      const result: LoadConfigResult = {
        pluginConfig: entry.pluginConfig,
        configPath: entry.configPath,
        tsconfigPath,
        rootPath: path.dirname(tsconfigPath),
      };
      if (isSolutionStyleConfig(tsconfig)) {
        if (!solutionFallback) solutionFallback = result;
      } else {
        const entryKey = `${toProjectKey(entry.configPath)}\0${toProjectKey(result.rootPath)}`;
        if (!seenEntries.has(entryKey)) {
          seenEntries.add(entryKey);
          results.push(result);
        }
      }
    }

    if (Array.isArray(tsconfig.references)) {
      hasReferences = true;
      for (const reference of tsconfig.references) {
        if (!reference || typeof reference.path !== 'string') continue;
        await visit(resolveReferencePath(reference.path, path.dirname(tsconfigPath)), false);
      }
    }
  };

  await visit(rootTsconfigPath, true);

  if (!results.length && solutionFallback) results.push(solutionFallback);
  if (!results.length) {
    throw new TadaError(
      `Could not find a valid GraphQLSP plugin entry in: ${maybeRelative(rootTsconfigPath)}` +
        (hasReferences ? ' or any of its referenced projects' : '')
    );
  }

  return results;
};

export const loadConfig = async (targetPath?: string): Promise<LoadConfigResult> =>
  (await loadConfigs(targetPath))[0];

/** @deprecated Use {@link loadConfig} instead */
export const resolveTypeScriptRootDir = async (
  tsconfigPath: string
): Promise<string | undefined> => {
  try {
    const result = await loadConfig(tsconfigPath);
    return path.dirname(result.configPath);
  } catch (_error) {
    return undefined;
  }
};
