import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { describe, it, expect } from 'vitest';

import type { TTY } from '../../../term';
import { loadProjects } from '../projects';
import { run as runGenerateOutput } from '../../generate-output/runner';

const SCHEMA = 'type Query {\n  hello: String\n}\n';

const PLUGIN = {
  name: '@0no-co/graphqlsp',
  schema: './schema.graphql',
  tadaOutputLocation: './src/graphql-env.d.ts',
};

const tty = { isInteractive: false, pipeTo: null } as TTY;

type Fixture = Record<string, unknown>;

const inFixture = async (files: Fixture, fn: (root: string) => Promise<void>): Promise<void> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'gql-tada-projects-'));
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

describe('loadProjects', () => {
  it('loads a referenced project from a solution-style root config', () => {
    return inFixture(
      {
        'tsconfig.json': {
          files: [],
          references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
        },
        'tsconfig.app.json': { compilerOptions: { plugins: [PLUGIN] }, include: ['src'] },
        'tsconfig.node.json': { include: ['vite.config.ts'] },
        'schema.graphql': SCHEMA,
      },
      async (root) => {
        const projects = await loadProjects(root);
        expect(projects).toHaveLength(1);
        expect(projects[0].projectPath).toBe(root);
        expect(projects[0].pluginConfig).toMatchObject({ schema: 'schema.graphql' });
      }
    );
  });

  it('throws when projects resolve output locations to the same file', () => {
    return inFixture(
      {
        'tsconfig.json': {
          files: [],
          references: [{ path: './packages/a' }, { path: './packages/b' }],
        },
        'packages/a/tsconfig.json': {
          compilerOptions: {
            plugins: [{ ...PLUGIN, tadaOutputLocation: '../graphql-env.d.ts' }],
          },
        },
        'packages/b/tsconfig.json': {
          compilerOptions: {
            plugins: [{ ...PLUGIN, tadaOutputLocation: '../graphql-env.d.ts' }],
          },
        },
        'packages/a/schema.graphql': SCHEMA,
        'packages/b/schema.graphql': SCHEMA,
      },
      async (root) => {
        await expect(loadProjects(root)).rejects.toThrow(/tadaOutputLocation/);
      }
    );
  });
});

describe('generate-output', () => {
  const collect = async (generator: AsyncIterable<unknown>): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _signal of generator) {
      /*noop*/
    }
  };

  it('writes the introspection output of a referenced project', () => {
    return inFixture(
      {
        'tsconfig.json': {
          files: [],
          references: [{ path: './tsconfig.app.json' }],
        },
        'tsconfig.app.json': { compilerOptions: { plugins: [PLUGIN] }, include: ['src'] },
        'schema.graphql': SCHEMA,
      },
      async (root) => {
        await collect(runGenerateOutput(tty, { output: undefined, tsconfig: root }));
        const output = await fs.readFile(path.join(root, 'src', 'graphql-env.d.ts'), 'utf8');
        expect(output).toContain("declare module 'gql.tada'");
      }
    );
  });

  it('writes introspection outputs for all referenced projects', () => {
    return inFixture(
      {
        'tsconfig.json': {
          files: [],
          references: [{ path: './packages/a' }, { path: './packages/b' }],
        },
        'packages/a/tsconfig.json': { compilerOptions: { plugins: [PLUGIN] } },
        'packages/b/tsconfig.json': { compilerOptions: { plugins: [PLUGIN] } },
        'packages/a/schema.graphql': SCHEMA,
        'packages/b/schema.graphql': SCHEMA,
      },
      async (root) => {
        await collect(runGenerateOutput(tty, { output: undefined, tsconfig: root }));
        for (const name of ['a', 'b']) {
          const output = await fs.readFile(
            path.join(root, 'packages', name, 'src', 'graphql-env.d.ts'),
            'utf8'
          );
          expect(output).toContain("declare module 'gql.tada'");
        }
      }
    );
  });
});
