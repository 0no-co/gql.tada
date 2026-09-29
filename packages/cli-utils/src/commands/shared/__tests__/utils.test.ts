import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { describe, it, expect } from 'vitest';

import { writeOutput } from '../utils';

const withTempFile = async (
  contents: string,
  fn: (filePath: string) => Promise<void>
): Promise<void> => {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'gql-tada-write-'));
  const filePath = path.join(rootPath, 'output.d.ts');
  try {
    await fs.writeFile(filePath, contents);
    await fn(filePath);
  } finally {
    await fs.rm(rootPath, { recursive: true, force: true });
  }
};

describe('writeOutput', () => {
  it('does not touch the file when the contents are unchanged', async () => {
    await withTempFile('unchanged', async (filePath) => {
      const past = new Date(Date.now() - 60_000);
      await fs.utimes(filePath, past, past);
      const before = (await fs.stat(filePath)).mtimeMs;

      await writeOutput(filePath, 'unchanged');

      const after = (await fs.stat(filePath)).mtimeMs;
      expect(after).toBe(before);
      await expect(fs.readFile(filePath, 'utf8')).resolves.toBe('unchanged');
    });
  });

  it('rewrites the file when the contents change', async () => {
    await withTempFile('before', async (filePath) => {
      await writeOutput(filePath, 'after');
      await expect(fs.readFile(filePath, 'utf8')).resolves.toBe('after');
    });
  });

  it('writes a new file when it does not exist', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'gql-tada-write-'));
    try {
      const filePath = path.join(rootPath, 'new.d.ts');
      await writeOutput(filePath, 'created');
      await expect(fs.readFile(filePath, 'utf8')).resolves.toBe('created');
    } finally {
      await fs.rm(rootPath, { recursive: true, force: true });
    }
  });
});
