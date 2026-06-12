import { expect, describe, it, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { loadRef, loadFromSDL } from '../index';

const VALID_SCHEMA = 'type Query { hello: String }';
const UPDATED_SCHEMA = 'type Query { hello: String, world: String }';
const INVALID_SCHEMA = 'type Query { hello: ';

const tmpdirs: string[] = [];

const makeSchemaFile = async (contents: string): Promise<string> => {
  // The realpath matters: macOS tmpdirs live behind a /var symlink, which
  // confuses fs-event watchers that report resolved paths
  const tmp = await fs.realpath(os.tmpdir());
  const dir = await fs.mkdtemp(path.join(tmp, 'tada-loaders-'));
  tmpdirs.push(dir);
  const file = path.join(dir, 'schema.graphql');
  await fs.writeFile(file, contents);
  return file;
};

afterEach(async () => {
  let dir: string | undefined;
  while ((dir = tmpdirs.pop()) != null) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

describe('loadFromSDL', () => {
  it('returns the cached result unless a reload is forced', async () => {
    const file = await makeSchemaFile(VALID_SCHEMA);
    const loader = loadFromSDL({ file, assumeValid: true });

    const initial = await loader.load();
    expect(initial.schema.getQueryType()!.getFields().world).toBeUndefined();

    await fs.writeFile(file, UPDATED_SCHEMA);
    const cached = await loader.load();
    expect(cached).toBe(initial);

    const reloaded = await loader.load(true);
    expect(reloaded.schema.getQueryType()!.getFields().world).toBeDefined();
  });
});

describe('loadRef', () => {
  it('supports forced reloads through load()', async () => {
    const file = await makeSchemaFile(VALID_SCHEMA);
    const ref = loadRef({ schema: file });

    await ref.load({});
    expect(ref.current!.schema.getQueryType()!.getFields().world).toBeUndefined();
    const version = ref.version;

    await fs.writeFile(file, UPDATED_SCHEMA);
    await ref.load({ reload: true });
    expect(ref.current!.schema.getQueryType()!.getFields().world).toBeDefined();
    expect(ref.version).toBeGreaterThan(version);
  });

  it('reports load failures during autoupdate setup through onError', async () => {
    const file = await makeSchemaFile(VALID_SCHEMA);
    const missing = path.join(path.dirname(file), 'does-not-exist.graphql');
    const ref = loadRef({
      schemas: [
        { name: 'valid', schema: file, tadaOutputLocation: 'valid.d.ts' },
        { name: 'broken', schema: missing, tadaOutputLocation: 'broken.d.ts' },
      ],
    });

    await expect(ref.load({})).rejects.toThrow(/does-not-exist\.graphql/);

    const errors: { message: string; name: string | undefined }[] = [];
    const teardown = ref.autoupdate(
      {},
      () => {},
      (error, input) => {
        errors.push({ message: error.message, name: input.name });
      }
    );

    try {
      // The autoupdate setup retries loaders that have no result yet and
      // reports their failures with the failing schema's input attached
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(errors).toHaveLength(1);
      expect(errors[0].name).toBe('broken');
      expect(errors[0].message).toMatch(/does-not-exist\.graphql/);
      expect(ref.multi.valid).not.toBeNull();
    } finally {
      teardown();
    }
  });

  it('reports watch-time reload failures through onError and recovers', async () => {
    const file = await makeSchemaFile(VALID_SCHEMA);
    const ref = loadRef({ schema: file });
    await ref.load({});

    const updates: unknown[] = [];
    const errors: Error[] = [];
    const teardown = ref.autoupdate(
      {},
      (schemaRef) => {
        updates.push(schemaRef.current);
      },
      (error) => {
        errors.push(error);
      }
    );

    // Repeatedly rewrites the file until the condition is met, since
    // fs-event watchers can miss events fired right after their creation
    const writeUntil = async (contents: string, condition: () => boolean) => {
      for (let attempt = 0; attempt < 40; attempt++) {
        await fs.writeFile(file, contents);
        const deadline = Date.now() + 500;
        while (Date.now() < deadline) {
          if (condition()) return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      }
      throw new Error('timed out waiting for the file watcher');
    };

    try {
      // Breaking the schema file must surface an error instead of silence
      await writeUntil(INVALID_SCHEMA, () => errors.length > 0);
      expect(errors[0].message).toMatch(/Syntax Error/);
      expect(updates).toHaveLength(0);

      // Fixing the file must notify subscribers again, i.e. the watcher
      // survived the failing reload
      await writeUntil(UPDATED_SCHEMA, () => updates.length > 0);
      expect(ref.current!.schema.getQueryType()!.getFields().world).toBeDefined();
    } finally {
      teardown();
    }
  }, 30_000);
});
