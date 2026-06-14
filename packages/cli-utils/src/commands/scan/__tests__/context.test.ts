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

describe('ScanContext builds a fragment graph from parsed documents', () => {
  const ctx = context([
    doc('query Q { viewer { ...A } }', '/p/q.ts'),
    doc('fragment A on User { id ...B }', '/p/a.ts'),
    doc('fragment B on User { name }', '/p/b.ts'),
  ]);
  const fragments = ctx.getFragmentGraph();

  it('resolves recursively referenced fragments through nesting', () => {
    const reachable = fragments.reachableFragments(ctx.operations[0].id);
    expect([...reachable].sort()).toEqual([':fragment:A', ':fragment:B']);
  });

  it('maps fragments back to the operations that reach them', () => {
    expect([...fragments.operationsReaching(':fragment:B')]).toEqual([':operation:Q']);
  });

  it('resolves fragments by name within a schema', () => {
    expect(fragments.resolve(null, 'A')).toBe(':fragment:A');
    expect(fragments.resolve(null, 'Missing')).toBeUndefined();
  });
});
