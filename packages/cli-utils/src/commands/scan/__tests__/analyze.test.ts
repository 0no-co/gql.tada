import { buildSchema } from 'graphql';
import { describe, it, expect } from 'vitest';

import { analyze } from '../analyze';
import type { RawScanDocument, SchemaName, RuleResults } from '../types';
import type { FieldUsageData } from '../rules';

/** Reads the field-usage rule's datapoints into a coordinate → data map. */
const fieldUsageMap = (rules: RuleResults): Map<string, FieldUsageData> => {
  const map = new Map<string, FieldUsageData>();
  for (const datapoint of rules['field-usage']) {
    if (datapoint.ref.kind === 'field')
      map.set(datapoint.ref.coordinate, datapoint.data as FieldUsageData);
  }
  return map;
};

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

const doc = (document: string, filePath: string): RawScanDocument => ({
  schemaName: null,
  document,
  filePath,
  line: 1,
  col: 1,
});

const run = (documents: RawScanDocument[]) =>
  analyze({ documents, schemas, imports: new Map(), warnings: [] });

describe('analyze', () => {
  it('builds a corpus of operation and fragment identities', () => {
    const { context } = run([
      doc('query GetPokemons($limit: Int) { pokemons(limit: $limit) { id ...Item } }', '/p/a.ts'),
      doc('fragment Item on Pokemon { id name }', '/p/b.ts'),
    ]);

    expect(context.operations).toHaveLength(1);
    const [op] = context.operations;
    expect(op.id).toBe(':operation:GetPokemons');
    expect(op.kind).toBe('query');
    expect(op.variables).toEqual(['limit']);
    expect(op.fragmentSpreads).toEqual(['Item']);

    expect(context.fragments).toHaveLength(1);
    expect(context.fragments[0].typeCondition).toBe('Pokemon');
  });

  it('keys field selections to schema coordinates via the field-usage rule', () => {
    const { rules } = run([
      doc('query GetPokemons { pokemons { id ...Item } }', '/p/a.ts'),
      doc('fragment Item on Pokemon { id name }', '/p/b.ts'),
    ]);
    const usage = fieldUsageMap(rules);

    expect(usage.get('Query.pokemons')?.count).toBe(1);
    expect(usage.get('Pokemon.id')?.count).toBe(2);
  });

  it('attributes fragment fields transitively to reaching operations', () => {
    const { rules } = run([
      doc('query GetPokemons { pokemons { ...Item } }', '/p/a.ts'),
      doc('fragment Item on Pokemon { id name }', '/p/b.ts'),
    ]);
    const name = fieldUsageMap(rules).get('Pokemon.name');

    // Selected directly only by the fragment...
    expect(name?.directUsages.map((usage) => usage.defId)).toEqual([':fragment:Item']);
    // ...but reached transitively by the operation that spreads it.
    expect(name?.operations).toEqual([':operation:GetPokemons']);
  });

  it('represents unused and deprecated schema fields', () => {
    const { rules } = run([
      doc('query GetPokemons { pokemons { id } }', '/p/a.ts'),
      doc('fragment Unused on Pokemon { legacy }', '/p/c.ts'),
    ]);
    const usage = fieldUsageMap(rules);

    expect(usage.get('Query.viewer')?.count).toBe(0);
    const legacy = usage.get('Pokemon.legacy');
    expect(legacy?.deprecated).toBe(true);
    expect(legacy?.count).toBe(1);
    // The fragment is never spread, so no operation reaches the deprecated field.
    expect(legacy?.operations).toEqual([]);
  });

  it('collects a warning when a document cannot be parsed', () => {
    const { context } = run([doc('query Broken { pokemons {', '/p/a.ts')]);
    expect(context.operations).toHaveLength(0);
    expect(context.warnings).toHaveLength(1);
    expect(context.warnings[0].file).toBe('/p/a.ts');
  });
});
