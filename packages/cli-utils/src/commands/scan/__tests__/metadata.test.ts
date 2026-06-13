import { buildSchema } from 'graphql';
import { describe, it, expect } from 'vitest';

import { buildMetadata } from '../metadata';
import type { RawScanDocument, SchemaName } from '../types';

const schema = buildSchema(`
  type Query {
    pokemons(limit: Int): [Pokemon]
    viewer: Pokemon
  }

  type Pokemon {
    id: ID!
    name: String!
    legacy: String @deprecated(reason: "old")
  }
`);

const schemas = new Map<SchemaName, ReturnType<typeof buildSchema>>([[null, schema]]);

const doc = (document: string, filePath: string, line = 1): RawScanDocument => ({
  schemaName: null,
  document,
  filePath,
  line,
  col: 1,
});

function metadataFor(documents: RawScanDocument[]) {
  return buildMetadata({ documents, schemas, imports: new Map(), warnings: [] });
}

describe('buildMetadata', () => {
  it('keys field selections to schema coordinates', () => {
    const metadata = metadataFor([
      doc('query GetPokemons { pokemons(limit: 10) { id ...Item } }', '/p/a.ts'),
      doc('fragment Item on Pokemon { id name }', '/p/b.ts'),
    ]);

    expect(metadata.operations).toHaveLength(1);
    const [op] = metadata.operations;
    expect(op.name).toBe('GetPokemons');
    expect(op.kind).toBe('query');
    expect(op.fields).toEqual(['Query.pokemons', 'Pokemon.id']);
    expect(op.fragmentSpreads).toEqual(['Item']);
    expect(op.depth).toBe(2);
    expect(op.variables).toEqual([]);

    expect(metadata.fieldIndex['Query.pokemons'].count).toBe(1);
    expect(metadata.fieldIndex['Pokemon.id'].count).toBe(2);
  });

  it('attributes fragment fields transitively to reaching operations', () => {
    const metadata = metadataFor([
      doc('query GetPokemons { pokemons { ...Item } }', '/p/a.ts'),
      doc('fragment Item on Pokemon { id name }', '/p/b.ts'),
    ]);

    // Pokemon.name is only selected directly in the fragment...
    const name = metadata.fieldIndex['Pokemon.name'];
    expect(name.directUsages.map((usage) => usage.defId)).toEqual([':fragment:Item']);
    // ...but the operation that spreads the fragment reaches it transitively.
    expect(name.operations).toEqual([':operation:GetPokemons']);
  });

  it('records unused and deprecated schema fields', () => {
    const metadata = metadataFor([
      doc('query GetPokemons { pokemons { id } }', '/p/a.ts'),
      doc('fragment Unused on Pokemon { legacy }', '/p/c.ts'),
    ]);

    expect(metadata.fieldIndex['Query.viewer'].count).toBe(0);
    const legacy = metadata.fieldIndex['Pokemon.legacy'];
    expect(legacy.deprecated).toBe(true);
    expect(legacy.deprecationReason).toBe('old');
    expect(legacy.count).toBe(1);
    // The fragment is never spread, so no operation reaches the deprecated field.
    expect(legacy.operations).toEqual([]);
  });

  it('computes schema coverage from the full field set', () => {
    const metadata = metadataFor([doc('query GetPokemons { pokemons { id name } }', '/p/a.ts')]);

    // Query: pokemons, viewer · Pokemon: id, name, legacy
    expect(metadata.coverage.totalFields).toBe(5);
    // Used: Query.pokemons, Pokemon.id, Pokemon.name
    expect(metadata.coverage.usedFields).toBe(3);
    const pokemon = metadata.coverage.perType.find((type) => type.typeName === 'Pokemon');
    expect(pokemon).toEqual({ typeName: 'Pokemon', totalFields: 3, usedFields: 2 });
  });

  it('builds a module ↔ document ↔ schema graph', () => {
    const metadata = metadataFor([
      doc('query GetPokemons { pokemons { id ...Item } }', '/p/a.ts'),
      doc('fragment Item on Pokemon { id name }', '/p/b.ts'),
    ]);

    const edgeKinds = new Set(metadata.graph.edges.map((edge) => edge.kind));
    expect(edgeKinds).toContain('defines');
    expect(edgeKinds).toContain('spreads');
    expect(edgeKinds).toContain('selects');
    expect(edgeKinds).toContain('onType');

    // The operation spreads the fragment.
    expect(metadata.graph.edges).toContainEqual({
      from: ':operation:GetPokemons',
      to: ':fragment:Item',
      kind: 'spreads',
    });
  });

  it('warns on documents that cannot be parsed', () => {
    const metadata = metadataFor([doc('query Broken { pokemons {', '/p/a.ts')]);
    expect(metadata.operations).toHaveLength(0);
    expect(metadata.warnings).toHaveLength(1);
    expect(metadata.warnings[0].file).toBe('/p/a.ts');
  });
});
