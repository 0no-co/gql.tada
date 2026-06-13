import { buildSchema } from 'graphql';
import { describe, it, expect } from 'vitest';

import { ScanContext } from '../context';
import type { RawScanDocument, SchemaName } from '../types';

const schema = buildSchema(`
  type Query {
    viewer: User
  }

  type User {
    id: ID!
    name: String!
  }
`);

const schemas = new Map<SchemaName, ReturnType<typeof buildSchema>>([[null, schema]]);

const doc = (document: string, filePath: string): RawScanDocument => ({
  schemaName: null,
  document,
  filePath,
  line: 1,
  col: 1,
});

function context(documents: RawScanDocument[]) {
  return new ScanContext({ documents, schemas, imports: new Map(), warnings: [] });
}

describe('ScanContext', () => {
  it('resolves recursively referenced fragments through nesting', () => {
    const ctx = context([
      doc('query Q { viewer { ...A } }', '/p/q.ts'),
      doc('fragment A on User { id ...B }', '/p/a.ts'),
      doc('fragment B on User { name }', '/p/b.ts'),
    ]);

    const operation = ctx.getDefinition(ctx.operations[0].id)!;
    const reachable = ctx.getRecursivelyReferencedFragments(operation);
    expect([...reachable].sort()).toEqual([':fragment:A', ':fragment:B']);
  });

  it('maps fragments back to the operations that reach them', () => {
    const ctx = context([
      doc('query Q { viewer { ...A } }', '/p/q.ts'),
      doc('fragment A on User { id ...B }', '/p/a.ts'),
      doc('fragment B on User { name }', '/p/b.ts'),
    ]);

    expect([...ctx.getOperationsReachingFragment(':fragment:B')]).toEqual([':operation:Q']);
  });

  it('resolves fragments by name within a schema', () => {
    const ctx = context([doc('fragment A on User { id }', '/p/a.ts')]);
    expect(ctx.getFragment(null, 'A')?.id).toBe(':fragment:A');
    expect(ctx.getFragment(null, 'Missing')).toBeUndefined();
  });
});
