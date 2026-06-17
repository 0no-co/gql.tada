import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { afterEach, describe, it, expect, vi } from 'vitest';

import type { TTY } from '../../../term';
import { generateOutput } from '../../generate-output';
import { generateSchema } from '../../generate-schema';
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

const mockTerminalOutput = () => {
  const write = (_chunk: unknown, encoding?: unknown, callback?: unknown) => {
    if (typeof encoding === 'function') {
      encoding();
    } else if (typeof callback === 'function') {
      callback();
    }
    return true;
  };

  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(write as never);
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(write as never);
  return { stdout, stderr };
};

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it('writes a shared output location only once across projects', () => {
    const sharedPlugin = {
      name: '@0no-co/graphqlsp',
      schema: '../../schema.graphql',
      tadaOutputLocation: '../../shared/graphql-env.d.ts',
    };
    return inFixture(
      {
        'tsconfig.json': {
          files: [],
          references: [{ path: './packages/a' }, { path: './packages/b' }],
        },
        'packages/a/tsconfig.json': { compilerOptions: { plugins: [sharedPlugin] } },
        'packages/b/tsconfig.json': { compilerOptions: { plugins: [sharedPlugin] } },
        'schema.graphql': SCHEMA,
      },
      async (root) => {
        const signals: unknown[] = [];
        for await (const signal of runGenerateOutput(tty, { output: undefined, tsconfig: root })) {
          signals.push(signal);
        }

        // A deduplicated project is skipped before emitting its project header.
        const headerCount = (JSON.stringify(signals).match(/tsconfig\.json/g) || []).length;
        expect(headerCount).toBe(1);

        const output = await fs.readFile(path.join(root, 'shared', 'graphql-env.d.ts'), 'utf8');
        expect(output).toContain("declare module 'gql.tada'");
      }
    );
  });

  it('does not write terminal output when silent is set', () => {
    return inFixture(
      {
        'tsconfig.json': { compilerOptions: { plugins: [PLUGIN] }, include: ['src'] },
        'schema.graphql': SCHEMA,
      },
      async (root) => {
        const terminal = mockTerminalOutput();

        await generateOutput({
          output: undefined,
          tsconfig: root,
          silent: true,
        });

        const output = await fs.readFile(path.join(root, 'src', 'graphql-env.d.ts'), 'utf8');
        expect(output).toContain("declare module 'gql.tada'");
        expect(terminal.stdout).not.toHaveBeenCalled();
        expect(terminal.stderr).not.toHaveBeenCalled();
      }
    );
  });
});

describe('generate-schema', () => {
  it('does not write terminal output when silent is set', () => {
    return inFixture(
      {
        'input.graphql': SCHEMA,
      },
      async (root) => {
        const terminal = mockTerminalOutput();
        const output = path.join(root, 'output.graphql');

        await generateSchema({
          input: path.join(root, 'input.graphql'),
          output,
          headers: undefined,
          tsconfig: undefined,
          silent: true,
        });

        await expect(fs.readFile(output, 'utf8')).resolves.toContain('type Query');
        expect(terminal.stdout).not.toHaveBeenCalled();
        expect(terminal.stderr).not.toHaveBeenCalled();
      }
    );
  });
});
