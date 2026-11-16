import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';

import { detectCompiler } from '../ts7';

const tmpdirs: string[] = [];

afterEach(async () => {
  let dir: string | undefined;
  while ((dir = tmpdirs.pop()) != null) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

const makeProject = async (packages: Record<string, string>): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gql-tada-check-ts7-'));
  tmpdirs.push(root);
  await fs.writeFile(path.join(root, 'tsconfig.json'), '{}');
  for (const name in packages) {
    const packageDir = path.join(root, 'node_modules', name);
    await fs.mkdir(packageDir, { recursive: true });
    await fs.writeFile(
      path.join(packageDir, 'package.json'),
      JSON.stringify({ name, version: packages[name] })
    );
  }
  return root;
};

const detect = (root: string, compiler?: 'typescript' | 'tsrs') =>
  detectCompiler({ rootPath: root, tsconfigPath: path.join(root, 'tsconfig.json'), compiler });

describe('detectCompiler', () => {
  it('uses the compiler API with TypeScript 5 and 6', async () => {
    expect(detect(await makeProject({ typescript: '5.9.3' }))).toBe(null);
    expect(detect(await makeProject({ typescript: '6.0.3' }))).toBe(null);
  });

  it('uses the TypeScript 7.1 API with TypeScript 7', async () => {
    expect(detect(await makeProject({ typescript: '7.1.0-beta' }))).toBe('typescript');
  });

  it('uses tsrs when only tsrs is installed', async () => {
    const root = await makeProject({ tsrs: '0.18.0-ts7.1.0-dev.20260929' });
    expect(detect(root)).toBe('tsrs');
    expect(detect(root, 'typescript')).toBe(null);
  });

  it('prefers TypeScript over tsrs unless tsrs is requested', async () => {
    const root = await makeProject({ typescript: '7.1.0-beta', tsrs: '0.18.0' });
    expect(detect(root)).toBe('typescript');
    expect(detect(root, 'tsrs')).toBe('tsrs');
  });
});
