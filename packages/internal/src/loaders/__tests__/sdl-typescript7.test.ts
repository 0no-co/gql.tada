import { expect, it, vi, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// `typescript@7` only exports its version, without the compiler API
vi.mock('typescript', () => ({ default: { version: '7.1.0' }, version: '7.1.0' }));

import { loadFromSDL } from '../sdl';

const tmpdirs: string[] = [];

afterEach(async () => {
  let dir: string | undefined;
  while ((dir = tmpdirs.pop()) != null) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

it('watches SDL schemas without the TypeScript compiler API', async () => {
  const tmp = await fs.realpath(os.tmpdir());
  const dir = await fs.mkdtemp(path.join(tmp, 'tada-sdl-ts7-'));
  tmpdirs.push(dir);
  const file = path.join(dir, 'schema.graphql');
  await fs.writeFile(file, 'type Query { hello: String }');

  const loader = loadFromSDL({ file });
  expect((await loader.load()).schema.getQueryType()!.getFields().world).toBeUndefined();

  const updated = new Promise<boolean>((resolve) => {
    const unsubscribe = loader.notifyOnUpdate((result) => {
      unsubscribe();
      resolve(!!result.schema.getQueryType()!.getFields().world);
    });
  });

  // The watcher starts once TypeScript has been looked up
  await new Promise((resolve) => setTimeout(resolve, 100));
  await fs.writeFile(file, 'type Query { hello: String, world: String }');
  expect(await updated).toBe(true);
});
