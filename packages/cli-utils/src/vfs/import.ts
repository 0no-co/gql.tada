import type { CompilerHost } from 'typescript';

import path from 'node:path';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { compilerOptions } from './compilerOptions';

export const requireResolve =
  typeof require === 'function' ? require.resolve : createRequire(import.meta.url).resolve;

const toPath = (input: string) => input.split(path.sep).join('/');

export async function importModule(host: CompilerHost, id: string) {
  const request = `${id}/package.json`;
  const module = requireResolve(request, {
    paths: ['node_modules', ...(requireResolve.paths(request) || [])],
  });
  if (!module) {
    throw new Error(`Failed to resolve "${id}"`);
  }

  const fromBasePath = path.dirname(module);
  const toBasePath = `/node_modules/${id}/`;

  async function walk(directory: string) {
    for (const entry of await fs.readdir(directory)) {
      const fromFilePath = path.join(directory, entry);
      if ((await fs.stat(fromFilePath)).isDirectory()) {
        await walk(fromFilePath);
      } else {
        const toFilePath = path.join(path.relative(fromBasePath, directory), entry);
        const data = await fs.readFile(fromFilePath, { encoding: 'utf8' });
        host.writeFile(toBasePath + toPath(toFilePath), data, false);
      }
    }
  }

  await walk(fromBasePath);
}

export async function importLib(host: CompilerHost) {
  const request = 'typescript/package.json';
  const module = requireResolve(request, {
    paths: ['node_modules', ...(requireResolve.paths(request) || [])],
  });
  if (!module) {
    throw new Error('Failed to resolve typescript');
  }

  const LIB_PATH = path.join(path.dirname(module), 'lib');
  const LIB_FILES = [
    'lib.es5.d.ts',
    'lib.es2015.symbol.d.ts',
    'lib.es2015.collection.d.ts',
    'lib.es2015.iterable.d.ts',
  ];

  const contents = (
    await Promise.all(
      LIB_FILES.map((libFile) => fs.readFile(path.resolve(LIB_PATH, libFile), { encoding: 'utf8' }))
    )
  ).join('\n');

  host.writeFile(host.getDefaultLibFileName(compilerOptions), contents, false);
}

export async function resolveModuleFile(from: string) {
  const slashIndex = from.indexOf('/');
  const id = from.slice(0, slashIndex);
  const subpath = from.slice(slashIndex);
  const request = `${id}/package.json`;
  const module = requireResolve(request, {
    paths: ['node_modules', ...(requireResolve.paths(request) || [])],
  });
  if (!module) {
    throw new Error(`Failed to resolve "${id}"`);
  }

  const fromFilePath = path.join(path.dirname(module), subpath);
  return fs.readFile(fromFilePath, { encoding: 'utf8' });
}
