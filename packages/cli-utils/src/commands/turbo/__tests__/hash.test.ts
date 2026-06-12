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
});

function createFixture(
  sourceText: string,
  schemaFingerprints: ReadonlyMap<string | null, string> = new Map()
) {
  const fileName = '/fixture.ts';
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TS
  );
  const host = ts.createCompilerHost({});
  host.getSourceFile = (requestedFileName) =>
    requestedFileName === fileName ? sourceFile : undefined;
  host.fileExists = (requestedFileName) => requestedFileName === fileName;
  host.readFile = (requestedFileName) => (requestedFileName === fileName ? sourceText : undefined);
  host.writeFile = () => {};

  const program = ts.createProgram({
    rootNames: [fileName],
    options: {
      noLib: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
    },
    host,
  });
  const checker = program.getTypeChecker();
  const calls = getExportedCalls(sourceFile);
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
