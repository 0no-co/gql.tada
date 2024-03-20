import type { ScriptTarget, CreateSourceFileOptions, SourceFile } from 'typescript';

import { createSourceFile } from 'typescript';
import { posix as path } from 'node:path';

import type { TargetCache } from './utils';
import { createTargetCache, setTargetCache, getTargetCache } from './utils';

export type FileData = Uint8Array | string;
export type Files = Record<string, FileData>;

export class File {
  cache: TargetCache<SourceFile>;
  name: string;
  data: Uint8Array | null;
  text: string | null;
  constructor(name: string, data: Uint8Array | string) {
    this.cache = createTargetCache();
    this.name = normalize(name);
    if (typeof data === 'string') {
      this.text = data || '\n';
      this.data = null;
    } else {
      this.text = null;
      this.data = data;
    }
  }

  toSourceFile(opts: ScriptTarget | CreateSourceFileOptions) {
    const target = typeof opts === 'object' ? opts.languageVersion : opts;
    return (
      getTargetCache(this.cache, target) ||
      setTargetCache(this.cache, target, createSourceFile(this.name, this.toString(), opts))
    );
  }

  toBuffer(): Uint8Array {
    return this.data || (this.data = new TextEncoder().encode(this.text!));
  }

  toString() {
    return this.text || (this.text = new TextDecoder().decode(this.data!));
  }
}

export class Directory {
  children: Record<string, Directory | undefined>;
  files: Record<string, File | undefined>;
  constructor() {
    this.children = Object.create(null);
    this.files = Object.create(null);
  }

  getOrCreateDirectory(name: string): Directory {
    return this.children[name] || (this.children[name] = new Directory());
  }
}

export function normalize(filename: string) {
  return path.normalize(!filename.startsWith(path.sep) ? path.sep + filename : filename);
}

export function split(filename: string): string[] {
  return filename !== path.sep ? filename.split(path.sep).slice(1) : [];
}

export const sep = path.sep;
