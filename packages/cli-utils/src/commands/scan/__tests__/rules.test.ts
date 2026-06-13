import { buildSchema } from 'graphql';
import { describe, it, expect } from 'vitest';

import { analyze } from '../analyze';
import type { RawScanDocument, SchemaName, DatapointRef } from '../types';

const schema = buildSchema(`
  type Query {
    pokemons: [Pokemon]
    viewer: Pokemon
  }

  type Pokemon {
    id: ID!
    name: String!
    legacy: String @deprecated(reason: "old")
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

const { rules } = analyze({
  documents: [
    doc('query A { pokemons { ...Item } }', '/p/a.ts'),
    doc('query B { viewer { ...Item legacy } }', '/p/b.ts'),
    doc('fragment Item on Pokemon { id name }', '/p/item.ts'),
    doc('fragment Orphan on Pokemon { id }', '/p/orphan.ts'),
  ],
  schemas,
  imports: new Map(),
  warnings: [],
});

const coordinateOf = (ref: DatapointRef) => (ref.kind === 'field' ? ref.coordinate : undefined);
const idOf = (ref: DatapointRef) =>
  ref.kind === 'operation' || ref.kind === 'fragment' ? ref.id : undefined;

describe('default rules', () => {
  it('deprecated-usage reports used deprecated fields', () => {
    const data = rules['deprecated-usage'];
    expect(data).toHaveLength(1);
    expect(coordinateOf(data[0].ref)).toBe('Pokemon.legacy');
  });

  it('orphan-fragments reports fragments that are never spread', () => {
    const ids = rules['orphan-fragments'].map((d) => idOf(d.ref));
    expect(ids).toContain(':fragment:Orphan');
    expect(ids).not.toContain(':fragment:Item');
  });

  it('input-usage counts enum values and input-object fields', () => {
    const inputSchema = buildSchema(`
      enum Sort { NEWEST  OLDEST }
      input Filter { sort: Sort  limit: Int }
      type Query { items(filter: Filter, sort: Sort): [String] }
    `);
    const result = analyze({
      documents: [
        doc('query Q { items(filter: { sort: NEWEST, limit: 5 }, sort: OLDEST) }', '/p/q.ts'),
      ],
      schemas: new Map([[null, inputSchema]]),
      imports: new Map(),
      warnings: [],
    });
    const coords = result.rules['input-usage'].map((d) =>
      d.ref.kind === 'field' ? d.ref.coordinate : undefined
    );
    expect(coords).toEqual(
      expect.arrayContaining(['Sort.NEWEST', 'Sort.OLDEST', 'Filter.sort', 'Filter.limit'])
    );
  });

  it('directive-usage counts directive applications', () => {
    const result = analyze({
      documents: [doc('query C { viewer @skip(if: true) { id @include(if: false) } }', '/p/c.ts')],
      schemas,
      imports: new Map(),
      warnings: [],
    });
    const names = result.rules['directive-usage'].map((d) =>
      d.ref.kind === 'directive' ? d.ref.name : undefined
    );
    expect(names).toContain('skip');
    expect(names).toContain('include');
  });

  it('operation-complexity ranks operations by score', () => {
    const complexity = rules['operation-complexity'];
    expect(complexity.length).toBe(2); // A, B
    const scores = complexity.map((d) => (d.data as { score: number }).score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('operation-complexity reports the transitive footprint through fragments', () => {
    // A = `query A { pokemons { ...Item } }`, Item = `{ id name }`.
    const a = rules['operation-complexity'].find(
      (d) => d.ref.kind === 'operation' && d.ref.id === ':operation:A'
    );
    const data = a?.data as { fieldCount: number; listFields: number; fields: string[] };
    expect(data.fields).toEqual(['Pokemon.id', 'Pokemon.name', 'Query.pokemons']);
    expect(data.fieldCount).toBe(3);
    // Query.pokemons returns a list.
    expect(data.listFields).toBe(1);
  });
});
