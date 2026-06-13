import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { describe, it, expect } from 'vitest';

import { loadConfig, loadConfigs } from '../resolve';

const PLUGIN = { name: '@0no-co/graphqlsp', schema: './schema.graphql' };

type Fixture = Record<string, unknown>;

const inFixture = async (files: Fixture, fn: (root: string) => Promise<void>): Promise<void> => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gql-tada-resolve-')));
  try {
    for (const name of Object.keys(files)) {
      const filePath = path.join(root, name);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const contents = files[name];
      await fs.writeFile(
        filePath,
        typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2)
      );
    }
    await fn(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
};

describe('loadConfigs', () => {
  it('resolves a single tsconfig with a plugin entry', () => {
    return inFixture(
      {
        'tsconfig.json': { compilerOptions: { plugins: [PLUGIN] }, include: ['src'] },
      },
      async (root) => {
        const results = await loadConfigs(root);
        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
          pluginConfig: PLUGIN,
          configPath: path.join(root, 'tsconfig.json'),
          tsconfigPath: path.join(root, 'tsconfig.json'),
          rootPath: root,
        });
      }
    );
  });

  it('resolves a referenced project from a solution-style root config', () => {
    return inFixture(
      {
        'tsconfig.json': {
          files: [],
          references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
        },
        'tsconfig.app.json': { compilerOptions: { plugins: [PLUGIN] }, include: ['src'] },
        'tsconfig.node.json': { include: ['vite.config.ts'] },
      },
      async (root) => {
        const results = await loadConfigs(root);
        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
          pluginConfig: PLUGIN,
          configPath: path.join(root, 'tsconfig.app.json'),
          tsconfigPath: path.join(root, 'tsconfig.app.json'),
          rootPath: root,
        });

        // `loadConfig` resolves the first project as well
        const result = await loadConfig(root);
        expect(result.tsconfigPath).toBe(path.join(root, 'tsconfig.app.json'));
      }
    );
  });

  it('resolves multiple referenced projects with directory references', () => {
    return inFixture(
      {
        'tsconfig.json': {
          files: [],
          references: [{ path: './packages/a' }, { path: './packages/b' }],
        },
        'packages/a/tsconfig.json': { compilerOptions: { plugins: [PLUGIN] } },
        'packages/b/tsconfig.json': { compilerOptions: { plugins: [PLUGIN] } },
      },
      async (root) => {
        const results = await loadConfigs(root);
        expect(results).toHaveLength(2);
        expect(results[0].tsconfigPath).toBe(path.join(root, 'packages', 'a', 'tsconfig.json'));
        expect(results[0].rootPath).toBe(path.join(root, 'packages', 'a'));
        expect(results[1].tsconfigPath).toBe(path.join(root, 'packages', 'b', 'tsconfig.json'));
        expect(results[1].rootPath).toBe(path.join(root, 'packages', 'b'));
      }
    );
  });

  it('resolves plugin entries of referenced projects through `extends`', () => {
    return inFixture(
      {
        'tsconfig.json': {
          files: [],
          references: [{ path: './tsconfig.app.json' }],
        },
        'tsconfig.base.json': { compilerOptions: { plugins: [PLUGIN] } },
        'tsconfig.app.json': { extends: './tsconfig.base.json', include: ['src'] },
      },
      async (root) => {
        const results = await loadConfigs(root);
        expect(results).toHaveLength(1);
        expect(results[0].configPath).toBe(path.join(root, 'tsconfig.base.json'));
        expect(results[0].tsconfigPath).toBe(path.join(root, 'tsconfig.app.json'));
      }
    );
  });

  it('keeps projects sharing a plugin entry through an `extends` base', () => {
    return inFixture(
      {
        'tsconfig.json': {
          files: [],
          references: [{ path: './packages/a' }, { path: './packages/b' }],
        },
        'tsconfig.base.json': { compilerOptions: { plugins: [PLUGIN] } },
        'packages/a/tsconfig.json': { extends: '../../tsconfig.base.json' },
        'packages/b/tsconfig.json': { extends: '../../tsconfig.base.json' },
      },
      async (root) => {
        const results = await loadConfigs(root);
        expect(results).toHaveLength(2);
        expect(results[0].configPath).toBe(path.join(root, 'tsconfig.base.json'));
        expect(results[1].configPath).toBe(path.join(root, 'tsconfig.base.json'));
        expect(results[0].rootPath).toBe(path.join(root, 'packages', 'a'));
        expect(results[1].rootPath).toBe(path.join(root, 'packages', 'b'));
      }
    );
  });

  it('terminates on circular and diamond references', () => {
    return inFixture(
      {
        'tsconfig.json': {
          files: [],
          references: [{ path: './a/tsconfig.json' }, { path: './b/tsconfig.json' }],
        },
        'a/tsconfig.json': {
          compilerOptions: { plugins: [PLUGIN] },
          references: [{ path: '../b/tsconfig.json' }],
        },
        'b/tsconfig.json': {
          compilerOptions: { plugins: [PLUGIN] },
          references: [{ path: '../a/tsconfig.json' }],
        },
      },
      async (root) => {
        const results = await loadConfigs(root);
        expect(results).toHaveLength(2);
        expect(results[0].rootPath).toBe(path.join(root, 'a'));
        expect(results[1].rootPath).toBe(path.join(root, 'b'));
      }
    );
  });

  it('resolves references with non-standard config file names', () => {
    return inFixture(
      {
        'tsconfig.json': {
          files: [],
          references: [{ path: './configs/custom.tsconfig.json' }],
        },
        'configs/custom.tsconfig.json': { compilerOptions: { plugins: [PLUGIN] } },
      },
      async (root) => {
        const results = await loadConfigs(root);
        expect(results).toHaveLength(1);
        expect(results[0].tsconfigPath).toBe(path.join(root, 'configs', 'custom.tsconfig.json'));
      }
    );
  });

  it('skips references to missing config files', () => {
    return inFixture(
      {
        'tsconfig.json': {
          files: [],
          references: [{ path: './missing' }, { path: './tsconfig.app.json' }],
        },
        'tsconfig.app.json': { compilerOptions: { plugins: [PLUGIN] } },
      },
      async (root) => {
        const results = await loadConfigs(root);
        expect(results).toHaveLength(1);
        expect(results[0].tsconfigPath).toBe(path.join(root, 'tsconfig.app.json'));
      }
    );
  });

  it('rejects malformed referenced config files', () => {
    return inFixture(
      {
        'tsconfig.json': {
          files: [],
          references: [{ path: './tsconfig.app.json' }],
        },
        'tsconfig.app.json': '{',
      },
      async (root) => {
        await expect(loadConfigs(root)).rejects.toThrow(/tsconfig\.app\.json/);
      }
    );
  });

  it('resolves a non-solution root config with plugin-less references', () => {
    return inFixture(
      {
        'tsconfig.json': {
          compilerOptions: { plugins: [PLUGIN] },
          include: ['src'],
          references: [{ path: './tsconfig.node.json' }],
        },
        'tsconfig.node.json': { include: ['vite.config.ts'] },
      },
      async (root) => {
        const results = await loadConfigs(root);
        expect(results).toHaveLength(1);
        expect(results[0].tsconfigPath).toBe(path.join(root, 'tsconfig.json'));
      }
    );
  });

  it('prefers referenced projects over a solution-style config with a plugin entry', () => {
    return inFixture(
      {
        'tsconfig.json': {
          compilerOptions: { plugins: [PLUGIN] },
          files: [],
          references: [{ path: './tsconfig.app.json' }],
        },
        'tsconfig.app.json': { compilerOptions: { plugins: [PLUGIN] }, include: ['src'] },
      },
      async (root) => {
        const results = await loadConfigs(root);
        expect(results).toHaveLength(1);
        expect(results[0].tsconfigPath).toBe(path.join(root, 'tsconfig.app.json'));
      }
    );
  });

  it('falls back to a solution-style config when no referenced project has a plugin entry', () => {
    return inFixture(
      {
        'tsconfig.json': {
          compilerOptions: { plugins: [PLUGIN] },
          files: [],
          references: [{ path: './tsconfig.app.json' }],
        },
        'tsconfig.app.json': { include: ['src'] },
      },
      async (root) => {
        const results = await loadConfigs(root);
        expect(results).toHaveLength(1);
        expect(results[0].tsconfigPath).toBe(path.join(root, 'tsconfig.json'));
        expect(results[0].rootPath).toBe(root);
      }
    );
  });

  it('rejects when no project has a plugin entry', () => {
    return inFixture(
      {
        'tsconfig.json': {
          files: [],
          references: [{ path: './tsconfig.app.json' }],
        },
        'tsconfig.app.json': { include: ['src'] },
      },
      async (root) => {
        await expect(loadConfigs(root)).rejects.toThrow(/referenced projects/);
      }
    );
  });
});
