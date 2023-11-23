import {
  ResolvedModule,
  CompilerHost,
  ScriptTarget,
  SourceFile,
  createModuleResolutionCache,
  resolveModuleName,
  createSourceFile,
} from '@0no-co/typescript.js';

import path from 'node:path/posix';
import { compilerOptions } from './compilerOptions';
import { readVirtualModule } from './virtualModules';

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

  toSourceFile(target: ScriptTarget) {
    return (
      this.cache[target] ||
      (this.cache[target] = createSourceFile(this.name, this.toString(), target))
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

export type VirtualHost = ReturnType<typeof createVirtualHost> extends infer U
  ? U extends CompilerHost
    ? U
    : never
  : never;

export function createVirtualHost(files: Files) {
  files = { ...files, ...readVirtualModule('@0no-co/typescript.js') };

  const cache = createModuleResolutionCache(path.sep, normalize, compilerOptions);
  const root = new Directory();

  function normalize(filename: string) {
    return path.normalize(!filename.startsWith(path.sep) ? path.sep + filename : filename);
  }

  function split(filename: string): string[] {
    return filename.split(path.sep).slice(1);
  }

  function lookup(filename: string): File | Directory | undefined {
    const parts = split(normalize(filename));
    let directory = root;
    for (let i = 0; i < parts.length - 1; i++) directory = directory.dir(parts[i]);
    return directory.get(parts[parts.length - 1]);
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
      // TODO: When another lib with references is selected, the resolution mode doesn't adapt
      return '/node_modules/@0no-co/typescript.js/lib/lib.es5.d.ts';
    },
    getCurrentDirectory() {
      return path.sep;
    },
    getNewLine() {
      return '\n';
    },
    useCaseSensitiveFileNames() {
      return true;
    },
    fileExists(filename: string) {
      return lookup(filename) instanceof File;
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

    getSourceFile(filename: string, target: ScriptTarget) {
      const entry = lookup(filename);
      if (entry instanceof File) {
        return entry.toSourceFile(target);
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

    resolveRootModule(moduleName: string) {
      return resolveModuleName(moduleName, '/', compilerOptions, this)?.resolvedModule
        ?.resolvedFileName;
    },
  };
}
