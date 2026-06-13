import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../ts/transformers', () => ({
  transformExtensions: [] as const,
  transform: vi.fn(),
}));

// NOTE: This is an opt-in performance harness for the `turbo` command, not part
// of the regular test suite. It requires `@gql.tada/internal` to be built.
// Run with:
//   BENCH=1 npx vitest run --typecheck.enabled=false --root packages/cli-utils perf.test
// Options: BENCH_FILES=<n> (default 100), BENCH_RUNS=<n> (default 3),
// BENCH_TAG=<tag> (writes a normalized output dump for correctness diffing)

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const EXAMPLE = path.join(REPO_ROOT, 'examples', 'example-pokemon-api');

const FILE_COUNT = Number(process.env.BENCH_FILES || 100);
const RUNS = Number(process.env.BENCH_RUNS || 3);
const BENCH_TAG = process.env.BENCH_TAG || '';

const SHARED_FRAGMENTS = `
import { graphql } from './graphql';

export const PokemonItemFragment = graphql(\`
  fragment PokemonItem on Pokemon {
    id
    name
    maxCP
    maxHP
  }
\`);

export const PokemonAttacksFragment = graphql(\`
  fragment PokemonAttacks on Pokemon {
    attacks {
      fast { name damage }
      special { name damage }
    }
  }
\`);
`;

const makeFile = (index: number): string => `
import { graphql } from './graphql';
import { PokemonItemFragment, PokemonAttacksFragment } from './fragments';

export const PokemonsQuery_${index} = graphql(\`
  query Pokemons_${index} ($limit: Int = 10) {
    pokemons(limit: $limit) {
      id
      fleeRate
      ...PokemonItem
      ...PokemonAttacks
    }
  }
\`, [PokemonItemFragment, PokemonAttacksFragment]);

export const PokemonQuery_${index} = graphql(\`
  query Pokemon_${index} ($id: ID!) {
    pokemon(id: $id) {
      id
      name
      weight { minimum maximum }
      ...PokemonItem
    }
  }
\`, [PokemonItemFragment]);

export const LocalFragment_${index} = graphql(\`
  fragment LocalPokemon_${index} on Pokemon {
    classification
    resistant
    weaknesses
  }
\`);
`;

const GRAPHQL_TS = `
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql-env';

export const graphql = initGraphQLTada<{
  introspection: introspection;
}>();

export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada';
export { readFragment } from 'gql.tada';
`;

async function createFixture(): Promise<{ rootPath: string; configPath: string }> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'gql-tada-turbo-bench-'));
  const srcPath = path.join(rootPath, 'src');
  await fs.mkdir(srcPath, { recursive: true });

  const tsconfig = {
    compilerOptions: {
      strict: true,
      target: 'es2017',
      module: 'esnext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      noEmit: true,
      skipLibCheck: true,
      paths: {
        'gql.tada': [path.join(REPO_ROOT, 'src', 'index.ts').replace(/\\/g, '/')],
      },
      plugins: [
        {
          name: '@0no-co/graphqlsp',
          schema: './schema.graphql',
          tadaOutputLocation: './src/graphql-env.d.ts',
          tadaTurboLocation: './src/graphql-cache.d.ts',
        },
      ],
    },
    include: ['src'],
  };

  await fs.writeFile(path.join(rootPath, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  await fs.copyFile(path.join(EXAMPLE, 'schema.graphql'), path.join(rootPath, 'schema.graphql'));
  await fs.copyFile(
    path.join(EXAMPLE, 'src', 'graphql-env.d.ts'),
    path.join(srcPath, 'graphql-env.d.ts')
  );
  await fs.writeFile(path.join(srcPath, 'graphql.ts'), GRAPHQL_TS);
  await fs.writeFile(path.join(srcPath, 'fragments.ts'), SHARED_FRAGMENTS);

  for (let index = 0; index < FILE_COUNT; index++) {
    await fs.writeFile(path.join(srcPath, `queries_${index}.ts`), makeFile(index));
  }

  return { rootPath, configPath: path.join(rootPath, 'tsconfig.json') };
}

describe.skipIf(!process.env.BENCH)('turbo performance', () => {
  it(
    'runs turbo end-to-end on a synthetic project',
    async () => {
      const { _runTurbo } = await import('../thread');
      // NOTE: The non-literal specifier defers resolution to runtime; this package
      // resolves to its built dist, which isn't available in CI, where this suite
      // is skipped before this import runs
      const internalPackageId = '@gql.tada/internal';
      const { loadConfig, parseConfig } = (await import(
        internalPackageId
      )) as typeof import('@gql.tada/internal');

      const { rootPath, configPath } = await createFixture();
      try {
        const configResult = await loadConfig(configPath);
        const pluginConfig = parseConfig(configResult.pluginConfig, configResult.rootPath);

        for (let run = 0; run < RUNS; run++) {
          const allDocuments: unknown[] = [];
          let graphqlSources: unknown[] = [];
          let documents = 0;
          let warnings = 0;
          let files = 0;

          const start = process.hrtime.bigint();
          for await (const signal of _runTurbo({
            rootPath: configResult.rootPath,
            tsconfigPath: configResult.tsconfigPath,
            configPath: configResult.configPath,
            pluginConfig,
            turboOutputPath: path.join(rootPath, 'src', 'graphql-cache.d.ts'),
          })) {
            if (signal.kind === 'FILE_TURBO') {
              files++;
              documents += signal.documents.length;
              warnings += signal.warnings.length;
              allDocuments.push(...signal.documents);
              for (const warning of signal.warnings) {
                // eslint-disable-next-line no-console
                console.log('WARN', warning.file, warning.line, warning.message);
              }
            } else if (signal.kind === 'GRAPHQL_SOURCES') {
              graphqlSources = signal.sources;
            }
          }
          const total = process.hrtime.bigint() - start;

          if (BENCH_TAG && run === 0) {
            // Dump normalized output to compare correctness across versions
            const normalize = (input: string): string =>
              input
                .split(rootPath.replace(/\\/g, '/'))
                .join('<ROOT>')
                .split(rootPath.replace(/\\/g, '\\\\'))
                .join('<ROOT>')
                .split(rootPath)
                .join('<ROOT>');
            const dump = normalize(
              JSON.stringify({ documents: allDocuments, sources: graphqlSources }, null, 2)
            );
            const dumpPath = path.join(os.tmpdir(), `turbo-bench-${BENCH_TAG}-${FILE_COUNT}.json`);
            await fs.writeFile(dumpPath, dump);
            // eslint-disable-next-line no-console
            console.log('dumped output to', dumpPath);
          }

          // eslint-disable-next-line no-console
          console.log(
            `run ${run + 1}/${RUNS}: files=${files} documents=${documents} ` +
              `warnings=${warnings} total=${(Number(total) / 1e6).toFixed(1)}ms`
          );

          expect(documents).toBe(FILE_COUNT * 3 + 2);
          expect(warnings).toBe(0);
          expect(graphqlSources.length).toBeGreaterThan(0);
        }
      } finally {
        await fs.rm(rootPath, { recursive: true, force: true });
      }
    },
    20 * 60 * 1000
  );
});
