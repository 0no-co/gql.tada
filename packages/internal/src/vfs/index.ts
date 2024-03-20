import type {
  CompilerHost,
  ResolvedModule,
  CreateSourceFileOptions,
  ScriptTarget,
} from 'typescript';

import {
  createProgram as tsCreateProgram,
  createModuleResolutionCache,
  resolveModuleName,
} from 'typescript';

import { compilerOptions } from './compilerOptions';
import { Directory, File, split, normalize, sep } from './host';

const ROOT_LIB_DTS_PATH = 'lib.d.ts';
const ROOT_LIB_DTS_DATA = '';

export { importLib, importModule, resolveModuleFile } from './import';

/** @internal */
export type VirtualCompilerHost = ReturnType<typeof createVirtualHost> & CompilerHost;

/** @internal */
export const createProgram = (rootNames: string[], host: CompilerHost) =>
  tsCreateProgram(rootNames, compilerOptions, host);

/** @internal */
export function createVirtualHost() {
  const cache = createModuleResolutionCache(sep, normalize, compilerOptions);

  const root = new Directory();
  root.files[ROOT_LIB_DTS_PATH] = new File(ROOT_LIB_DTS_PATH, ROOT_LIB_DTS_DATA);

  return {
    getCanonicalFileName: normalize,

    getDefaultLibFileName() {
      return sep + ROOT_LIB_DTS_PATH;
    },
    getCurrentDirectory() {
      return sep;
    },
    getNewLine() {
      return '\n';
    },
    getModuleResolutionCache() {
      return cache;
    },
    useCaseSensitiveFileNames() {
      return true;
    },

    fileExists(filename: string) {
      const parts = split(normalize(filename));
      let directory: Directory | undefined = root;
      for (let i = 0; i < parts.length - 1; i++) {
        directory = directory.children[parts[i]];
        if (!directory) return false;
      }
      return !!directory.files[parts[parts.length - 1]];
    },

    directoryExists(directoryName: string) {
      const parts = split(normalize(directoryName));
      if (!parts.length) return true;
      let directory: Directory | undefined = root;
      for (let i = 0; i < parts.length - 1; i++) {
        directory = directory.children[parts[i]];
        if (!directory) return false;
      }
      return !!directory.children[parts[parts.length - 1]];
    },

    writeFile(filename: string, content: Uint8Array | string) {
      const name = normalize(filename);
      const parts = split(name);
      let directory = root;
      for (let i = 0; i < parts.length - 1; i++)
        directory = directory.getOrCreateDirectory(parts[i]);
      directory.files[parts[parts.length - 1]] = new File(name, content);
    },

    getDirectories(directoryName: string) {
      const parts = split(normalize(directoryName));
      let directory: Directory | undefined = root;
      for (let i = 0; i < parts.length; i++) {
        directory = directory.children[parts[i]];
        if (!directory) return [];
      }
      return Object.keys(directory.children);
    },

    readFile(filename: string) {
      const parts = split(normalize(filename));
      let directory: Directory | undefined = root;
      for (let i = 0; i < parts.length - 1; i++) {
        directory = directory.children[parts[i]];
        if (!directory) return undefined;
      }
      const file = directory.files[parts[parts.length - 1]];
      return file && file.toString();
    },

    getSourceFile(
      filename: string,
      languageVersionOrOptions: ScriptTarget | CreateSourceFileOptions
    ) {
      const parts = split(normalize(filename));
      let directory: Directory | undefined = root;
      for (let i = 0; i < parts.length - 1; i++) {
        directory = directory.children[parts[i]];
        if (!directory) return undefined;
      }
      const file = directory.files[parts[parts.length - 1]];
      return file && file.toSourceFile(languageVersionOrOptions);
    },

    resolveModuleNames(moduleNames: string[], containingFile: string) {
      const resolvedModules: (ResolvedModule | undefined)[] = [];
      for (const moduleName of moduleNames) {
        const result = resolveModuleName(moduleName, containingFile, compilerOptions, this, cache);
        resolvedModules.push(result.resolvedModule);
      }
      return resolvedModules;
    },
  } satisfies CompilerHost;
}
