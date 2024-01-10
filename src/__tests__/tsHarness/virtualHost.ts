import type {
  CompilerOptions,
  ResolvedModule,
  CompilerHost,
  ScriptTarget,
  CreateSourceFileOptions,
  SourceFile,
  JsxEmit,
} from '@0no-co/typescript.js';
import {
  ModuleResolutionKind,
  createModuleResolutionCache,
  resolveModuleName,
  createSourceFile,
} from '@0no-co/typescript.js';

import fs from 'fs';
import { posix as path } from 'path';

export const compilerOptions: CompilerOptions = {
  rootDir: '/',
  moduleResolution: ModuleResolutionKind.Bundler,
  skipLibCheck: true,
  skipDefaultLibCheck: true,
  allowImportingTsExtensions: true,
  allowSyntheticDefaultImports: true,
  resolvePackageJsonExports: true,
  resolvePackageJsonImports: true,
  resolveJsonModule: true,
  esModuleInterop: true,
  jsx: 1 satisfies JsxEmit.Preserve,
  target: 99 satisfies ScriptTarget.Latest,
  checkJs: false,
  allowJs: true,
  strict: true,
  noEmit: true,
  noLib: false,
  disableReferencedProjectLoad: true,
  disableSourceOfProjectReferenceRedirect: true,
  disableSizeLimit: true,
  disableSolutionSearching: true,
};

export type FileData = Uint8Array | string;
export type Files = Record<string, FileData>;

class File {
  cache: Record<ScriptTarget, SourceFile | undefined> = Object.create(null);
  name: string;
  data: Uint8Array | null;
  text: string | null;

  constructor(name: string, data: Uint8Array | string) {
    this.name = name;
    if (typeof data === 'string') {
      this.text = data;
      this.data = null;
    } else {
      this.text = null;
      this.data = data;
    }
  }

  toSourceFile(languageVersionOrOptions: ScriptTarget | CreateSourceFileOptions) {
    const target =
      typeof languageVersionOrOptions === 'object'
        ? languageVersionOrOptions.languageVersion
        : languageVersionOrOptions;
    return (
      this.cache[target] ||
      (this.cache[target] = createSourceFile(this.name, this.toString(), languageVersionOrOptions))
    );
  }

  toBuffer(): Uint8Array {
    return this.data || (this.data = new TextEncoder().encode(this.text!));
  }

  toString() {
    return this.text || (this.text = new TextDecoder().decode(this.data!));
  }
}

class Directory {
  children: Record<string, Directory | File | undefined> = Object.create(null);

  get(name: string): Directory | File | undefined {
    return this.children[name];
  }

  dir(name: string): Directory {
    const entry = this.children[name];
    return entry instanceof Directory ? entry : (this.children[name] = new Directory());
  }

  set(name: string, file: File) {
    this.children[name] = file;
  }
}

const virtualRoot = path.resolve(__dirname, '../../../');

const _virtualModuleCache: Record<string, Files> = {};
const _sourceFolderCache: Record<string, Files> = {};
const _fileCache: Record<string, FileData> = {};

export function readFileFromRoot(name: string): FileData {
  return _fileCache[name] || (_fileCache[name] = fs.readFileSync(path.join(virtualRoot, name)));
}

export function readVirtualModule(moduleName: string): Files {
  let files: Files = _virtualModuleCache[moduleName];
  if (!files) {
    files = {};
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
  }
  return (_virtualModuleCache[moduleName] = files);
}

export function readSourceFolders(directories: string[]): Files {
  let combinedFiles: Files = {};
  for (const directory of directories) {
    let files: Files = _sourceFolderCache[directory];
    if (!files) {
      files = _sourceFolderCache[directory] = {};
      const target = path.resolve(virtualRoot, 'src', directory);
      for (const entry of fs.readdirSync(target)) {
        const entryTarget = path.resolve(target, entry);
        const stat = fs.statSync(entryTarget);
        if (stat.isFile() && /\.ts$/.test(entry)) {
          files[path.join(directory, entry)] = fs.readFileSync(entryTarget).toString();
        }
      }
    }
    combinedFiles = Object.assign(combinedFiles, files);
  }
  return combinedFiles;
}

export type VirtualHost = ReturnType<typeof createVirtualHost> extends infer U
  ? U extends CompilerHost
    ? U
    : never
  : never;

export function createVirtualHost(files: Files) {
  // TODO: When another lib with references is selected, the resolution mode doesn't adapt
  files['lib.d.ts'] = readFileFromRoot('node_modules/@0no-co/typescript.js/lib/lib.es5.d.ts');

  const cache = createModuleResolutionCache(path.sep, normalize, compilerOptions);
  const root = new Directory();

  function normalize(filename: string) {
    return path.normalize(!filename.startsWith(path.sep) ? path.sep + filename : filename);
  }

  function split(filename: string): string[] {
    return filename !== path.sep ? filename.split(path.sep).slice(1) : [];
  }

  function lookup(filename: string): File | Directory | undefined {
    const parts = split(normalize(filename));
    let directory = root;
    if (parts.length) {
      for (let i = 0; i < parts.length - 1; i++) directory = directory.dir(parts[i]);
      return directory.get(parts[parts.length - 1]);
    } else {
      return directory;
    }
  }

  for (const key in files) {
    const name = normalize(key);
    const data = files[key];
    const parts = split(name);
    let directory = root;
    for (let i = 0; i < parts.length - 1; i++) directory = directory.dir(parts[i]);
    directory.set(parts[parts.length - 1], new File(name, data));
  }

  return {
    getCanonicalFileName: normalize,
    getDefaultLibFileName() {
      return '/lib.d.ts';
    },
    getCurrentDirectory() {
      return path.sep;
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
    useSourceOfProjectReferenceRedirect() {
      return false;
    },
    fileExists(filename: string) {
      return lookup(filename) instanceof File;
    },
    directoryExists(directoryName: string) {
      return lookup(directoryName) instanceof Directory;
    },

    writeFile(filename: string, content: Uint8Array | string) {
      const name = normalize(filename);
      const parts = split(name);
      let directory = root;
      for (let i = 0; i < parts.length - 1; i++) directory = directory.dir(parts[i]);
      directory.set(parts[parts.length - 1], new File(name, content));
    },

    getDirectories(dir: string) {
      const entry = lookup(dir);
      const result: string[] = [];
      if (entry instanceof Directory) {
        for (const key in entry.children) {
          if (entry.children[key] instanceof Directory) result.push(key);
        }
      }
      return result;
    },

    readFile(filename: string) {
      const entry = lookup(filename);
      if (entry instanceof File) {
        return entry.toString();
      }
    },

    getSourceFile(
      filename: string,
      languageVersionOrOptions: ScriptTarget | CreateSourceFileOptions
    ) {
      const entry = lookup(filename);
      if (entry instanceof File) {
        return entry.toSourceFile(languageVersionOrOptions);
      }
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
