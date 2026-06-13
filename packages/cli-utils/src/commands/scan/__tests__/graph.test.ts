import { buildSchema } from 'graphql';
import { describe, it, expect } from 'vitest';

import { analyze } from '../analyze';
import { buildGraph } from '../output/graph';
import type { RawScanDocument, SchemaName } from '../types';

const schema = buildSchema(`
  type Query { pokemons: [Pokemon] }
  type Pokemon { id: ID!  name: String! }
`);
const schemas = new Map<SchemaName, ReturnType<typeof buildSchema>>([[null, schema]]);

const doc = (document: string, filePath: string): RawScanDocument => ({
  schemaName: null,
  document,
  filePath,
  line: 1,
  col: 1,
});

describe('buildGraph', () => {
  const { context, rules } = analyze({
    documents: [
      doc('query A { pokemons { id ...Item } }', '/p/a.ts'),
      doc('fragment Item on Pokemon { name }', '/p/item.ts'),
    ],
    schemas,
    imports: new Map(),
    warnings: [],
  });
  const graph = buildGraph(context, rules);

  it('links modules, documents, fragments, and schema', () => {
    const edgeKinds = new Set(graph.edges.map((e) => e.kind));
    expect(edgeKinds).toContain('defines');
    expect(edgeKinds).toContain('spreads');
    expect(edgeKinds).toContain('selects');
    expect(edgeKinds).toContain('onType');
  });

  it('connects an operation to the fragment it spreads', () => {
    expect(graph.edges).toContainEqual({
      from: ':operation:A',
      to: ':fragment:Item',
      kind: 'spreads',
    });
  });

  it('only includes used schema fields as nodes', () => {
    const fieldNodes = graph.nodes.filter((n) => n.kind === 'schemaField').map((n) => n.label);
    expect(fieldNodes.sort()).toEqual(['Pokemon.id', 'Pokemon.name', 'Query.pokemons']);
  });

  it('emits the full module import graph, including non-document modules', () => {
    // /p/a.ts imports /p/util.ts (no documents) which imports /p/item.ts.
    const { context: ctx, rules: r } = analyze({
      documents: [
        doc('query A { pokemons { ...Item } }', '/p/a.ts'),
        doc('fragment Item on Pokemon { name }', '/p/item.ts'),
      ],
      schemas,
      imports: new Map([
        ['/p/a.ts', ['/p/util.ts']],
        ['/p/util.ts', ['/p/item.ts']],
      ]),
      warnings: [],
    });
    const g = buildGraph(ctx, r);
    // The intermediate non-document module appears as a node...
    expect(g.nodes.some((n) => n.id === 'module:/p/util.ts')).toBe(true);
    // ...and its import edges are present.
    expect(g.edges).toContainEqual({
      from: 'module:/p/a.ts',
      to: 'module:/p/util.ts',
      kind: 'imports',
    });
    expect(g.edges).toContainEqual({
      from: 'module:/p/util.ts',
      to: 'module:/p/item.ts',
      kind: 'imports',
    });
  });
});
