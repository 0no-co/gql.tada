import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const dirname =
  typeof __dirname !== 'string' ? path.dirname(fileURLToPath(import.meta.url)) : __dirname;

export const requireResolve =
  typeof require === 'function' ? require.resolve : createRequire(import.meta.url).resolve;

export const loadTypings = async () => {
  const tadaModule = requireResolve('gql.tada/package.json', {
    paths: ['node_modules', ...(requireResolve.paths('gql.tada') || [])],
  });

  const typingsPath = path.join(path.dirname(tadaModule), 'dist/gql-tada.d.ts');
  return readFile(typingsPath, { encoding: 'utf8' });
};
