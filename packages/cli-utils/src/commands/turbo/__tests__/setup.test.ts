import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import ts from 'typescript';
import { buildSchema, introspectionFromSchema } from 'graphql';
import { describe, it, expect, vi } from 'vitest';
import { minifyIntrospection, outputIntrospectionFile } from '@gql.tada/internal';

vi.mock('../../../ts/transformers', () => ({
  transformExtensions: [] as const,
  transform: vi.fn(),
}));

import type { TurboDocument, GraphQLSourceFile } from '../types';
import { _runTurbo } from '../thread';
import { createCacheContents } from '../runner';

const REPO_ROOT = path.resolve(__dirname, '../../../../../..');
const SCHEMA = `
  scalar DateTime
  type Query { now: DateTime }
`;

async function fixture() {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'gql-tada-setup-'));
  const configPath = path.join(rootPath, 'tsconfig.json');
  const cachePath = path.join(rootPath, 'graphql-cache.d.ts');
  const pluginConfig = {
    schema: './schema.graphql',
    tadaOutputLocation: './graphql-env.d.ts',
    tadaTurboLocation: './graphql-cache.d.ts',
  };
  await fs.writeFile(path.join(rootPath, 'schema.graphql'), SCHEMA);
  await fs.writeFile(
    path.join(rootPath, 'graphql-env.d.ts'),
    outputIntrospectionFile(minifyIntrospection(introspectionFromSchema(buildSchema(SCHEMA))), {
      fileType: '.d.ts',
      shouldPreprocess: true,
    })
  );
  await fs.writeFile(
    configPath,
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        target: 'es2022',
        module: 'esnext',
        moduleResolution: 'bundler',
        types: [],
        paths: { 'gql.tada': [path.join(REPO_ROOT, 'src/index.ts').replace(/\\/g, '/')] },
        plugins: [{ name: '@0no-co/graphqlsp', ...pluginConfig }],
      },
      include: ['*.ts'],
    })
  );
  // NOTE: Uses gql.tada's default `graphql` export, typed as `initGraphQLTada<setupSchema>`
  await fs.writeFile(
    path.join(rootPath, 'documents.ts'),
    `import { graphql } from 'gql.tada';
     export const query = graphql(\`query Now { now }\`);`
  );

  return {
    async setScalar(type: string) {
      await fs.writeFile(
        path.join(rootPath, 'setup.ts'),
        `import type { introspection } from './graphql-env';
         interface Scalars { DateTime: ${type} }
         declare module 'gql.tada' {
           interface setupSchema { introspection: introspection; scalars: Scalars }
         }`
      );
    },
    getGraphQLAliasName() {
      const config = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, rootPath);
      const program = ts.createProgram(parsed.fileNames, parsed.options);
      const sourceFile = program.getSourceFile(path.join(rootPath, 'documents.ts'))!;
      const statement = sourceFile.statements[1] as ts.VariableStatement;
      const call = statement.declarationList.declarations[0].initializer as ts.CallExpression;
      const calleeType = program.getTypeChecker().getTypeAtLocation(call.expression);
      return calleeType.aliasSymbol && calleeType.aliasSymbol.name;
    },
    async generate() {
      const documents: TurboDocument[] = [];
      let sources: GraphQLSourceFile[] = [];
      for await (const signal of _runTurbo({
        rootPath,
        configPath,
        pluginConfig,
        turboOutputPath: cachePath,
      })) {
        if (signal.kind === 'FILE_TURBO') {
          expect(signal.warnings).toEqual([]);
          documents.push(...signal.documents);
        } else if (signal.kind === 'GRAPHQL_SOURCES') {
          sources = signal.sources;
        }
      }
      await fs.writeFile(cachePath, createCacheContents(documents, sources, cachePath));
      return documents;
    },
    async dispose() {
      await fs.rm(rootPath, { recursive: true, force: true });
    },
  };
}

describe('Turbo setup fingerprint', () => {
  it('regenerates cached documents when a `setupSchema` scalar changes', async () => {
    const project = await fixture();
    try {
      await project.setScalar('string');
      // NOTE: The setup fingerprint relies on the callee keeping its `initGraphQLTada` alias
      expect(project.getGraphQLAliasName()).toBe('initGraphQLTada');

      const [before] = await project.generate();
      expect(before.documentType).toContain('now: string | null');

      const [cached] = await project.generate();
      expect(cached.isCached).toBe(true);

      await project.setScalar('number');
      const [after] = await project.generate();
      expect(after.isCached).toBeFalsy();
      expect(after.documentHash).not.toBe(before.documentHash);
      expect(after.documentType).toContain('now: number | null');
    } finally {
      await project.dispose();
    }
  }, 30_000);
});
