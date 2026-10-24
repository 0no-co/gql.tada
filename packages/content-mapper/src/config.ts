import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

/** A schema file configured through the GraphQLSP / `gql.tada` plugin config. */
export interface SchemaEntry {
  /** Absolute path of the schema file. */
  file: string;
  /** Whether the file contains SDL or a JSON introspection result. */
  format: 'sdl' | 'json';
  /** The `schemas[].name` label of a multi-schema setup. */
  name?: string;
}

export interface ProjectConfig {
  schemas: SchemaEntry[];
  /** Absolute paths of every `tsconfig.json` that was read, including `extends` chains. */
  configFiles: string[];
}

const PLUGIN_NAMES = new Set(['@0no-co/graphqlsp', 'gql.tada/lsp', 'gql.tada/ts-plugin']);

/** Parses `tsconfig.json`'s JSONC dialect: comments and trailing commas are allowed. */
export const parseJSONC = (input: string): any => {
  let output = '';
  let idx = input.charCodeAt(0) === 0xfeff ? 1 : 0;
  while (idx < input.length) {
    const char = input[idx];
    if (char === '"') {
      const start = idx++;
      while (idx < input.length && input[idx] !== '"') idx += input[idx] === '\\' ? 2 : 1;
      output += input.slice(start, ++idx);
    } else if (char === '/' && input[idx + 1] === '/') {
      while (idx < input.length && input[idx] !== '\n') idx++;
    } else if (char === '/' && input[idx + 1] === '*') {
      const end = input.indexOf('*/', idx + 2);
      idx = end === -1 ? input.length : end + 2;
    } else {
      output += char;
      idx++;
    }
  }
  return output.trim() ? JSON.parse(output.replace(/,(\s*[}\]])/g, '$1')) : {};
};

const resolveExtends = (specifier: string, fromConfig: string): string | null => {
  const fromDir = path.dirname(fromConfig);
  if (specifier.startsWith('.') || path.isAbsolute(specifier)) {
    const resolved = path.resolve(fromDir, specifier);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
    return fs.existsSync(`${resolved}.json`) ? `${resolved}.json` : null;
  }
  const require = createRequire(fromConfig);
  for (const candidate of [specifier, `${specifier}/tsconfig.json`, `${specifier}.json`]) {
    try {
      return require.resolve(candidate);
    } catch {}
  }
  return null;
};

type PluginConfig = Record<string, unknown>;

/** Finds the nearest gql.tada plugin entry, following `extends` like `@gql.tada/internal`. */
const findPluginConfig = (
  configFile: string,
  configFiles: string[],
  seen = new Set<string>()
): PluginConfig | null => {
  if (seen.has(configFile)) return null;
  seen.add(configFile);
  let tsconfig: any;
  try {
    tsconfig = parseJSONC(fs.readFileSync(configFile, 'utf8'));
    configFiles.push(configFile);
  } catch {
    return null;
  }
  const plugins = tsconfig && tsconfig.compilerOptions && tsconfig.compilerOptions.plugins;
  const plugin =
    Array.isArray(plugins) &&
    plugins.find((plugin) => plugin && PLUGIN_NAMES.has((plugin as PluginConfig).name as string));
  if (plugin) return plugin;
  const extendsList: unknown[] = Array.isArray(tsconfig.extends)
    ? // Later entries override earlier ones, so the last one wins
      [...tsconfig.extends].reverse()
    : tsconfig.extends
      ? [tsconfig.extends]
      : [];
  for (const specifier of extendsList) {
    if (typeof specifier !== 'string') continue;
    const resolved = resolveExtends(specifier, configFile);
    const found = resolved && findPluginConfig(resolved, configFiles, seen);
    if (found) return found;
  }
  return null;
};

const toSchemaFile = (
  schema: unknown,
  rootPath: string
): Pick<SchemaEntry, 'file' | 'format'> | null => {
  if (typeof schema !== 'string' || /^https?:\/\//i.test(schema)) return null;
  const file = path.resolve(rootPath, schema.replace(/\$\{configDir\}/g, rootPath));
  const extension = path.extname(file);
  if (extension === '.graphql' || extension === '.gql') {
    return { file, format: 'sdl' };
  } else if (extension === '.json') {
    return { file, format: 'json' };
  } else {
    return null;
  }
};

/** Reads the project's SDL and JSON introspection schema files from its GraphQLSP / `gql.tada` plugin config.
 *
 * @remarks
 * TypeScript 7 only passes plugin names (not their options) as compiler options, so the
 * tsconfig is read here. Relative paths resolve against the project's own `tsconfig.json`,
 * as in GraphQLSP. URL schemas are skipped.
 */
export const readProjectConfig = (configFileName: string): ProjectConfig => {
  const configFiles: string[] = [];
  const schemas: SchemaEntry[] = [];
  if (!configFileName) return { schemas, configFiles };
  const rootPath = path.dirname(configFileName);
  const plugin = findPluginConfig(configFileName, configFiles);
  if (plugin && Array.isArray(plugin.schemas)) {
    for (const entry of plugin.schemas) {
      const schema = entry && toSchemaFile(entry.schema, rootPath);
      if (schema && typeof entry.name === 'string') schemas.push({ ...schema, name: entry.name });
    }
  } else if (plugin) {
    // A single schema's `name` is the plugin's name, which `generate output` ignores too
    const schema = toSchemaFile(plugin.schema, rootPath);
    if (schema) schemas.push(schema);
  }
  return { schemas, configFiles };
};
