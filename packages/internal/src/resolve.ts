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
      (x) => x.name === '@0no-co/graphqlsp' || x.name === 'gql.tada/lsp'
    )) ||
  null;

export interface LoadConfigResult {
  pluginConfig: Record<string, unknown>;
  configPath: string;
  rootPath: string;
}

export const loadConfig = async (targetPath?: string): Promise<LoadConfigResult> => {
  const rootTsconfigPath = await findTSConfigFile(targetPath);
  if (!rootTsconfigPath) {
    throw new TadaError(
      targetPath
        ? `No tsconfig.json found at or above: ${maybeRelative(targetPath)}`
        : 'No tsconfig.json found at or above current working directory'
    );
  }
  const tsconfig = await readTSConfigFile(rootTsconfigPath);
  const pluginConfig = getPluginConfig(tsconfig);
  if (pluginConfig) {
    return {
      pluginConfig,
      configPath: rootTsconfigPath,
      rootPath: path.dirname(rootTsconfigPath),
    };
  }

  if (Array.isArray(tsconfig.extends)) {
    for (let extend of tsconfig.extends) {
      if (path.extname(extend) !== '.json') extend += '.json';
      try {
        const tsconfigPath = await resolveExtend(extend, path.dirname(rootTsconfigPath));
        if (tsconfigPath) {
          const config = loadConfig(targetPath);
          return {
            ...config,
            rootPath: path.dirname(rootTsconfigPath),
          };
        }
      } catch (_error) {}
    }
  } else if (tsconfig.extends) {
    try {
      const tsconfigPath = await resolveExtend(tsconfig.extends, path.dirname(rootTsconfigPath));
      if (tsconfigPath) {
        const config = loadConfig(targetPath);
        return {
          ...config,
          rootPath: path.dirname(rootTsconfigPath),
        };
      }
    } catch (_error) {}
  }

  throw new TadaError(
    `Could not find a valid GraphQLSP plugin entry in: ${maybeRelative(rootTsconfigPath)}`
  );
};

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
