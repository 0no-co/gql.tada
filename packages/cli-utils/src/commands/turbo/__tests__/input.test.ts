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
  scalar Anything
  scalar Func
  enum Mode { ON OFF }
  type Query {
    field(arg: SomeInput, mutual: FirstInput, list: ListInput, typed: TypedInput, choice: ChoiceInput, batch: [[SomeInput!]!]): String
  }
  input SomeInput { field: String inner: SomeInput }
  input FirstInput { field: String inner: SecondInput }
  input SecondInput { back: FirstInput }
  input ListInput { field: String children: [ListInput!] }
  input ChoiceInput @oneOf { field: String inner: ChoiceInput }
  input TypedInput {
    required: String!
    defaulted: String! = "default"
    mode: Mode!
    date: DateTime!
    anything: Anything
    fn: Func
    functions: [Func]
    values: [[SomeInput!]!]
  }
`;

async function fixture(source: string, shouldPreprocess = true) {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'gql-tada-inputs-'));
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
      shouldPreprocess,
    })
  );
  await fs.writeFile(
    path.join(rootPath, 'graphql.ts'),
    `import { initGraphQLTada } from 'gql.tada';
     import type { introspection } from './graphql-env';
     export const graphql = initGraphQLTada<{ introspection: introspection; scalars: { DateTime: Date; Anything: any; Func: () => string } }>();
     export const graphqlString = initGraphQLTada<{ introspection: introspection; scalars: { DateTime: string; Anything: any; Func: () => string } }>();`
  );
  await fs.writeFile(
    configPath,
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        skipLibCheck: false,
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
  await fs.writeFile(path.join(rootPath, 'documents.ts'), source);

  return {
    rootPath,
    cachePath,
    async check() {
      const config = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, rootPath);
      const program = ts.createProgram(parsed.fileNames, parsed.options);
      return ts
        .getPreEmitDiagnostics(program)
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
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
      const contents = createCacheContents(documents, sources, cachePath);
      await fs.writeFile(cachePath, contents);
      return { documents, contents };
    },
    async dispose() {
      await fs.rm(rootPath, { recursive: true, force: true });
    },
  };
}

describe('Turbo input aliases', () => {
  it.each([
    [
      'self recursion',
      'SomeInput',
      'arg',
      "{ field: '', inner: { field: 1 } }",
      "{ inner: { inner: { field: 'ok' } } }",
    ],
    [
      'mutual recursion',
      'FirstInput',
      'mutual',
      '{ inner: { back: { field: 1 } } }',
      "{ inner: { back: { inner: { back: { field: 'ok' } } } } }",
    ],
    [
      'list recursion',
      'ListInput',
      'list',
      '{ children: [{ field: 1 }] }',
      "{ children: [{ children: [{ field: 'ok' }] }] }",
    ],
  ])(
    'preserves %s through generation and cache reuse',
    async (_, type, argument, invalid, valid) => {
      const project = await fixture(`
      import { graphql } from './graphql';
      import type { VariablesOf } from 'gql.tada';
      const query = graphql('query ($arg: ${type}) { field(${argument}: $arg) }');
      const second = graphql('query Second ($arg: ${type}!) { field(${argument}: $arg) }');
      const valid: VariablesOf<typeof query> = { arg: ${valid} };
      const optional: VariablesOf<typeof query> = {};
      const nullable: VariablesOf<typeof query> = { arg: null };
      // @ts-expect-error Nested String inputs must not become any.
      const invalid: VariablesOf<typeof query> = { arg: ${invalid} };
      // @ts-expect-error Non-null variables remain required.
      const missing: VariablesOf<typeof second> = {};
    `);
      try {
        expect(await project.check()).toEqual([]);
        const first = await project.generate();
        expect(first.documents).toHaveLength(2);
        expect(first.contents).not.toMatch(/\bany\b/);
        expect(
          first.contents.match(new RegExp(`type \\$tadaInput_\\w+_${type} =`, 'g'))
        ).toHaveLength(1);
        expect(await project.check()).toEqual([]);
        const cached = await project.generate();
        expect(cached.documents.every((document) => document.isCached)).toBe(true);
        expect(cached.contents).toBe(first.contents);
        expect(await project.check()).toEqual([]);
      } finally {
        await project.dispose();
      }
    },
    30_000
  );

  it('preserves scalar mappings, enums, defaults, and nested list nullability', async () => {
    const project = await fixture(`
      import { graphql } from './graphql';
      import type { VariablesOf } from 'gql.tada';
      const query = graphql('query ($arg: TypedInput! = {required: "x", mode: ON, date: "x"}) { field(typed: $arg) }');
      const optional: VariablesOf<typeof query> = {};
      const defaulted: VariablesOf<typeof query> = { arg: { required: '', defaulted: null, mode: 'OFF', date: new Date(), values: null } };
      const functions: VariablesOf<typeof query> = { arg: { required: '', mode: 'ON', date: new Date(), fn: null, functions: [null, () => 'ok'] } };
      // @ts-expect-error Nullability applies to the scalar, not its return type.
      const badFunction: VariablesOf<typeof query> = { arg: { required: '', mode: 'ON', date: new Date(), fn: () => null } };
      const valid: VariablesOf<typeof query> = { arg: { required: '', mode: 'ON', date: new Date(), anything: { arbitrary: 123 }, values: [[{inner: {field: 'ok'}}]] } };
      // @ts-expect-error The default does not permit null for a non-null variable.
      const nullVariable: VariablesOf<typeof query> = { arg: null };
      // @ts-expect-error Required input fields stay required.
      const missing: VariablesOf<typeof query> = { arg: { mode: 'ON', date: new Date() } };
      // @ts-expect-error Enum values stay constrained.
      const mode: VariablesOf<typeof query> = { arg: { required: '', mode: 'OTHER', date: new Date() } };
      // @ts-expect-error The configured DateTime scalar stays Date.
      const date: VariablesOf<typeof query> = { arg: { required: '', mode: 'ON', date: 'bad' } };
      // @ts-expect-error Non-null list elements stay non-null.
      const list: VariablesOf<typeof query> = { arg: { required: '', mode: 'ON', date: new Date(), values: [[null]] } };
    `);
    try {
      expect(await project.check()).toEqual([]);
      const { contents } = await project.generate();
      expect(contents).toContain('Date');
      expect(contents).toContain('any');
      expect(await project.check()).toEqual([]);
    } finally {
      await project.dispose();
    }
  }, 30_000);

  it('preserves recursive oneOf inputs and list variables with raw introspection', async () => {
    const project = await fixture(
      `
      import { graphql } from './graphql';
      import type { VariablesOf } from 'gql.tada';
      const query = graphql('query ($arg: ChoiceInput, $batch: [[SomeInput!]!]) { field(choice: $arg, batch: $batch) }');
      const valid: VariablesOf<typeof query> = { arg: {inner: {inner: {field: 'ok'}}}, batch: [[{ inner: { field: 'ok' } }]] };
      const nullable: VariablesOf<typeof query> = { batch: null };
      // @ts-expect-error A recursive oneOf branch retains its field type.
      const invalid: VariablesOf<typeof query> = { arg: {inner: {field: 1}} };
      // @ts-expect-error oneOf branches are non-null.
      const branch: VariablesOf<typeof query> = { arg: {inner: null} };
      // @ts-expect-error A oneOf input needs a branch.
      const empty: VariablesOf<typeof query> = { arg: {} };
      // @ts-expect-error Nested list input objects retain their field types.
      const list: VariablesOf<typeof query> = { batch: [[{inner: {field: 1}}]] };
      // @ts-expect-error Nested non-null lists cannot be null.
      const nullList: VariablesOf<typeof query> = { batch: [null] };
    `,
      false
    );
    try {
      expect(await project.check()).toEqual([]);
      await project.generate();
      expect(await project.check()).toEqual([]);
    } finally {
      await project.dispose();
    }
  }, 30_000);

  it('keeps aliases separate for different scalar mappings of the same schema', async () => {
    const project = await fixture(`
      import { graphql, graphqlString } from './graphql';
      import type { VariablesOf } from 'gql.tada';
      const dates = graphql('query Dates ($arg: TypedInput!) { field(typed: $arg) }');
      const strings = graphqlString('query Strings ($arg: TypedInput!) { field(typed: $arg) }');
      const date: VariablesOf<typeof dates> = { arg: { required: '', mode: 'ON', date: new Date() } };
      const string: VariablesOf<typeof strings> = { arg: { required: '', mode: 'ON', date: 'ok' } };
      // @ts-expect-error A string scalar mapping must not replace a Date mapping.
      const badDate: VariablesOf<typeof dates> = { arg: { required: '', mode: 'ON', date: 'bad' } };
      // @ts-expect-error A Date mapping must not replace a string scalar mapping.
      const badString: VariablesOf<typeof strings> = { arg: { required: '', mode: 'ON', date: new Date() } };
    `);
    try {
      expect(await project.check()).toEqual([]);
      const { contents } = await project.generate();
      expect(contents.match(/type \$tadaInput_\w+_TypedInput =/g)).toHaveLength(2);
      expect(await project.check()).toEqual([]);
      expect((await project.generate()).contents).toBe(contents);
      expect(await project.check()).toEqual([]);
    } finally {
      await project.dispose();
    }
  }, 30_000);

  it('drops unused aliases while retaining dependencies of cached operations', async () => {
    const source = `import { graphql } from './graphql';
      const mutual = graphql('query Mutual ($arg: FirstInput) { field(mutual: $arg) }');`;
    const project = await fixture(
      source +
        `
      const removed = graphql('query Removed ($arg: SomeInput) { field(arg: $arg) }');`
    );
    try {
      const first = await project.generate();
      expect(first.contents).toMatch(/type \$tadaInput_\w+_SomeInput =/);
      await fs.writeFile(path.join(project.rootPath, 'documents.ts'), source);
      const cached = await project.generate();
      expect(cached.documents).toHaveLength(1);
      expect(cached.documents[0].isCached).toBe(true);
      expect(cached.contents).not.toMatch(/type \$tadaInput_\w+_SomeInput =/);
      expect(cached.contents).toMatch(/type \$tadaInput_\w+_FirstInput =/);
      expect(cached.contents).toMatch(/type \$tadaInput_\w+_SecondInput =/);
      expect(await project.check()).toEqual([]);
    } finally {
      await project.dispose();
    }
  }, 30_000);

  it('does not shadow list types with copied scalar imports named Array', async () => {
    const project = await fixture(`
      import { graphql } from './graphql';
      import type { VariablesOf } from 'gql.tada';
      const query = graphql('query ($arg: TypedInput, $batch: [[SomeInput!]!]) { field(typed: $arg, batch: $batch) }');
      const valid: VariablesOf<typeof query> = { arg: {required: '', mode: 'ON', date: new Date(), anything: {tag: 'ok'}, values: [[{field: 'ok'}]]}, batch: [[{inner: {field: 'ok'}}]] };
      // @ts-expect-error Scalar imports must not weaken nested list input types.
      const invalid: VariablesOf<typeof query> = { batch: [[{inner: {field: 1}}]] };
    `);
    try {
      const graphqlPath = path.join(project.rootPath, 'graphql.ts');
      await fs.writeFile(
        path.join(project.rootPath, 'scalars.ts'),
        'export type Array = { tag: string };'
      );
      await fs.writeFile(
        graphqlPath,
        `import type { Array } from './scalars';\n` +
          (await fs.readFile(graphqlPath, 'utf8')).replace(/Anything: any/g, 'Anything: Array')
      );
      expect(await project.check()).toEqual([]);
      const { contents } = await project.generate();
      expect(contents).toContain("import type { Array } from './scalars'");
      expect(await project.check()).toEqual([]);
    } finally {
      await project.dispose();
    }
  }, 30_000);
});
