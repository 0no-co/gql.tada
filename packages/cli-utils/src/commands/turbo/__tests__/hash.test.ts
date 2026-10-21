import ts from 'typescript';
import { describe, it, expect } from 'vitest';

import { createDocumentHasher } from '../hash';

describe('createDocumentHasher', () => {
  it('includes fragment dependency hashes in operation hashes', () => {
    const first = createFixture(`
      declare const graphql: any;
      export const fragment = graphql(\`fragment Item on Todo { id }\`);
      export const query = graphql(\`query Todos { todos { ...Item } }\`, [fragment]);
    `);
    const second = createFixture(`
      declare const graphql: any;
      export const fragment = graphql(\`fragment Item on Todo { id text }\`);
      export const query = graphql(\`query Todos { todos { ...Item } }\`, [fragment]);
    `);

    expect(first.hashes.query.hashable).toBe(true);
    expect(second.hashes.query.hashable).toBe(true);
    expect(first.hashes.query.documentHash).not.toBe(second.hashes.query.documentHash);
  });

  it('salts hashes by schema name', () => {
    const fixture = createFixture(`
      declare const graphql: any;
      export const query = graphql(\`query Todos { todos { id } }\`);
    `);

    const a = fixture.hasher.hashCallExpression(fixture.calls.query, 'a');
    const b = fixture.hasher.hashCallExpression(fixture.calls.query, 'b');

    expect(a.documentHash).not.toBe(b.documentHash);
  });

  it('salts hashes by schema fingerprint', () => {
    const before = createFixture(
      `
        declare const graphql: any;
        export const query = graphql(\`query Todos { todos { id } }\`);
      `,
      new Map([[null, 'sha256:schema-a']])
    );
    const after = createFixture(
      `
        declare const graphql: any;
        export const query = graphql(\`query Todos { todos { id } }\`);
      `,
      new Map([[null, 'sha256:schema-b']])
    );

    expect(before.hashes.query.hashable).toBe(true);
    expect(after.hashes.query.hashable).toBe(true);
    expect(before.hashes.query.documentHash).not.toBe(after.hashes.query.documentHash);
  });

  it('does not hash dynamic fragment lists', () => {
    const fixture = createFixture(`
      declare const graphql: any;
      declare const fragments: readonly any[];
      export const query = graphql(\`query Todos { todos { id } }\`, fragments);
    `);

    expect(fixture.hashes.query).toEqual({ hashable: false });
  });

  describe('setup fingerprint', () => {
    // NOTE: Mirrors the shape of gql.tada's `initGraphQLTada` and `GraphQLTadaAPI` types
    const declareTada = (setup: string, declaration = 'initGraphQLTada') => `
      interface GraphQLTadaAPI<Schema, Config> {
        (input: string, fragments?: readonly unknown[]): { schema: Schema; config: Config };
      }
      type initGraphQLTada<Setup> = GraphQLTadaAPI<
        { types: Setup extends { scalars: infer Scalars } ? Scalars : {} },
        { isMaskingDisabled: Setup extends { disableMasking: true } ? true : false }
      >;
      declare const graphql: ${declaration === 'initGraphQLTada' ? `initGraphQLTada<${setup}>` : declaration};
      export const fragment = graphql(\`fragment Item on Todo { createdAt }\`);
      export const query = graphql(\`query Todos { todos { ...Item } }\`, [fragment]);
    `;

    it('changes when a scalar mapping changes', () => {
      const before = createFixture(declareTada('{ scalars: { DateTime: string } }'));
      const after = createFixture(declareTada('{ scalars: { DateTime: number } }'));

      expect(before.hashes.query.hashable).toBe(true);
      expect(after.hashes.query.hashable).toBe(true);
      expect(before.hashes.fragment.documentHash).not.toBe(after.hashes.fragment.documentHash);
      expect(before.hashes.query.documentHash).not.toBe(after.hashes.query.documentHash);
    });

    it('changes when an imported scalar type alias resolves to a different type', () => {
      const sourceText = `
        import type { DateTime } from './scalars';
        ${declareTada('{ scalars: { DateTime: DateTime } }')}
      `;
      const before = createFixture(sourceText, undefined, {
        '/scalars.ts': 'export type DateTime = string;',
      });
      const after = createFixture(sourceText, undefined, {
        '/scalars.ts': 'export type DateTime = number;',
      });

      expect(before.hashes.query.documentHash).not.toBe(after.hashes.query.documentHash);
    });

    it('keeps the hash when a referenced scalar type changes but keeps its name', () => {
      // NOTE: The cached document type refers to `DateTime` by name, so it remains valid
      const sourceText = `
        import type { DateTime } from './scalars';
        ${declareTada('{ scalars: { DateTime: DateTime } }')}
      `;
      const before = createFixture(sourceText, undefined, {
        '/scalars.ts': 'export interface DateTime { value: string }',
      });
      const after = createFixture(sourceText, undefined, {
        '/scalars.ts': 'export interface DateTime { value: number }',
      });

      expect(before.hashes.query.documentHash).toBe(after.hashes.query.documentHash);
    });

    it('ignores the introspection option', () => {
      const before = createFixture(declareTada('{ introspection: { a: 1 }; scalars: {} }'));
      const after = createFixture(declareTada('{ introspection: { b: 2 }; scalars: {} }'));

      expect(before.hashes.query.documentHash).toBe(after.hashes.query.documentHash);
    });

    it('changes when masking is disabled', () => {
      const before = createFixture(declareTada('{ scalars: {} }'));
      const after = createFixture(declareTada('{ scalars: {}; disableMasking: true }'));

      expect(before.hashes.query.documentHash).not.toBe(after.hashes.query.documentHash);
    });

    it('falls back to the resolved schema type without an `initGraphQLTada` alias', () => {
      const declaration = (scalar: string) =>
        `GraphQLTadaAPI<{ types: { DateTime: ${scalar} } }, { isMaskingDisabled: false }>`;
      const before = createFixture(declareTada('', declaration('string')));
      const after = createFixture(declareTada('', declaration('number')));

      expect(before.hashes.query.hashable).toBe(true);
      expect(before.hashes.query.documentHash).not.toBe(after.hashes.query.documentHash);
    });
  });
});

function createFixture(
  sourceText: string,
  schemaFingerprints: ReadonlyMap<string | null, string> = new Map(),
  extraFiles: Record<string, string> = {}
) {
  const fileName = '/fixture.ts';
  const files = new Map<string, string>([[fileName, sourceText]]);
  for (const [extraFileName, extraSourceText] of Object.entries(extraFiles))
    files.set(extraFileName, extraSourceText);

  const sourceFiles = new Map<string, ts.SourceFile>();
  const getSourceFile = (requestedFileName: string) => {
    let sourceFile = sourceFiles.get(requestedFileName);
    const sourceText = files.get(requestedFileName);
    if (!sourceFile && sourceText != null) {
      sourceFile = ts.createSourceFile(
        requestedFileName,
        sourceText,
        ts.ScriptTarget.Latest,
        /*setParentNodes*/ true,
        ts.ScriptKind.TS
      );
      sourceFiles.set(requestedFileName, sourceFile);
    }
    return sourceFile;
  };

  const host = ts.createCompilerHost({});
  host.getSourceFile = getSourceFile;
  host.fileExists = (requestedFileName) => files.has(requestedFileName);
  host.readFile = (requestedFileName) => files.get(requestedFileName);
  host.writeFile = () => {};

  const program = ts.createProgram({
    rootNames: [fileName],
    options: {
      noLib: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
    host,
  });
  const checker = program.getTypeChecker();
  const calls = getExportedCalls(getSourceFile(fileName)!);
  const hasher = createDocumentHasher({
    checker,
    schemaFingerprints,
  });
  const hashes = Object.fromEntries(
    Object.entries(calls).map(([name, call]) => [name, hasher.hashCallExpression(call, null)])
  );

  return { calls, hashes, hasher };
}

function getExportedCalls(sourceFile: ts.SourceFile): Record<string, ts.CallExpression> {
  const calls: Record<string, ts.CallExpression> = {};

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      calls[node.name.text] = node.initializer;
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return calls;
}
