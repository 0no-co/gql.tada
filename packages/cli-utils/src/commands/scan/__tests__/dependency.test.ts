import { buildSchema } from 'graphql';
import { describe, it, expect } from 'vitest';

import { analyze } from '../analyze';
import { ScanContext } from '../context';
import { fieldUsageMap } from '../output/util';
import type { RawScanDocument, SchemaName, DatapointRef } from '../types';

const schema = buildSchema(`
  type Query { a: Thing  b: Thing }
  type Mutation { touch: Thing }
  type Thing { id: ID!  name: String! }
`);
const schemas = new Map<SchemaName, ReturnType<typeof buildSchema>>([[null, schema]]);

const doc = (document: string, filePath: string): RawScanDocument => ({
  schemaName: null,
  document,
  filePath,
  line: 1,
  col: 1,
});

// app.ts -> featureA/list.ts, featureB/card.ts ; both -> shared/frag.ts
const imports = new Map<string, string[]>([
  ['/p/app.ts', ['/p/featureA/list.ts', '/p/featureB/card.ts']],
  ['/p/featureA/list.ts', ['/p/shared/frag.ts']],
  ['/p/featureB/card.ts', ['/p/shared/frag.ts']],
  ['/p/shared/frag.ts', []],
]);

const documents = [
  doc('query A { a { ...Shared } }', '/p/featureA/list.ts'),
  doc('query B { b { ...Shared } }', '/p/featureB/card.ts'),
  doc('mutation M { touch { id } }', '/p/featureA/list.ts'),
  doc('fragment Shared on Thing { id name }', '/p/shared/frag.ts'),
];

const idOf = (ref: DatapointRef) =>
  ref.kind === 'operation' || ref.kind === 'fragment' ? ref.id : undefined;

describe('ModuleGraph (via ScanContext)', () => {
  const context = new ScanContext({ documents, schemas, imports, warnings: [] });
  const graph = context.getModuleGraph();

  it('identifies entry points (modules nothing imports)', () => {
    expect([...graph.entryPoints()]).toEqual(['/p/app.ts']);
  });

  it('computes transitive dependents', () => {
    expect([...graph.dependents('/p/shared/frag.ts')].sort()).toEqual([
      '/p/app.ts',
      '/p/featureA/list.ts',
      '/p/featureB/card.ts',
    ]);
  });

  it('measures distance from an entry point', () => {
    expect(graph.distanceFromEntry('/p/app.ts')).toBe(0);
    expect(graph.distanceFromEntry('/p/featureA/list.ts')).toBe(1);
    expect(graph.distanceFromEntry('/p/shared/frag.ts')).toBe(2);
  });

  it('derives areas from module directories', () => {
    expect(graph.areaOf('/p/shared/frag.ts')).toBe('/p/shared');
  });
});

describe('dependency-graph rules', () => {
  const { rules } = analyze({ documents, schemas, imports, warnings: [] });

  it('cross-feature-fragments quantifies coupling across areas', () => {
    const data = rules['cross-feature-fragments'];
    expect(data).toHaveLength(1);
    expect(idOf(data[0].ref)).toBe(':fragment:Shared');
    expect(data[0].weight).toBe(2);
    expect((data[0].data as { consumerAreas: string[] }).consumerAreas).toHaveLength(2);
  });

  it('fetch-depth records each operation distance from an entry point', () => {
    const depthOf = (id: string) =>
      (rules['fetch-depth'].find((d) => idOf(d.ref) === id)?.data as { depth: number | null })
        .depth;
    expect(depthOf(':operation:A')).toBe(1);
    expect(depthOf(':operation:B')).toBe(1);
  });

  it('fetch-depth ignores mutations (only queries carry the signal)', () => {
    const ids = rules['fetch-depth'].map((d) => idOf(d.ref));
    expect(ids).toContain(':operation:A');
    expect(ids).not.toContain(':operation:M');
  });

  it('field-usage records blast radius (reach) and weight', () => {
    const name = fieldUsageMap(rules).get('Thing.name')!;
    // Selected in the shared fragment, reached by both operations under app.
    expect(name.reach.entryPoints).toBe(1); // /p/app.ts
    expect(name.reach.areas).toContain('/p/featureA');
    expect(name.reach.areas).toContain('/p/featureB');
  });
});
