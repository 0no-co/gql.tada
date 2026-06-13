import { buildSchema } from 'graphql';
import { describe, it, expect } from 'vitest';

import { buildMetadata } from '../metadata';
import { runRules } from '../rules';
import type { RawScanDocument, SchemaName, ScanMetadata } from '../types';

const schema = buildSchema(`
  type Query {
    pokemons: [Pokemon]
    viewer: Pokemon
  }

  type Pokemon {
    id: ID!
    name: String!
    height: Int
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

const fixture: ScanMetadata = buildMetadata({
  documents: [
    doc('query A { pokemons { ...Item } }', '/p/a.ts'),
    doc('query B { viewer { ...Item legacy } }', '/p/b.ts'),
    doc('fragment Item on Pokemon { id name }', '/p/item.ts'),
    doc('fragment Orphan on Pokemon { id }', '/p/orphan.ts'),
    doc('query Same { viewer { id } }', '/p/d.ts'),
    doc('query Same { viewer { id } }', '/p/e.ts'),
  ],
  schemas,
  imports: new Map(),
  warnings: [],
});

describe('default rules', () => {
  const rules = runRules(fixture);

  it('unused-fields reports fields never selected', () => {
    const coordinates = rules['unused-fields'].map(
      (d) => (d.ref as { coordinate: string }).coordinate
    );
    expect(coordinates).toContain('Pokemon.height');
    expect(coordinates).not.toContain('Pokemon.id');
  });

  it('deprecated-usage reports used deprecated fields', () => {
    const data = rules['deprecated-usage'];
    expect(data).toHaveLength(1);
    expect((data[0].ref as { coordinate: string }).coordinate).toBe('Pokemon.legacy');
  });

  it('orphan-fragments reports fragments that are never spread', () => {
    const ids = rules['orphan-fragments'].map((d) => (d.ref as { id: string }).id);
    expect(ids).toContain(':fragment:Orphan');
    expect(ids).not.toContain(':fragment:Item');
  });

  it('coupling-hotspots reports widely-shared fragments', () => {
    const hotspots = rules['coupling-hotspots'];
    // Item is spread by both A and B.
    expect(hotspots).toHaveLength(1);
    expect((hotspots[0].ref as { id: string }).id).toBe(':fragment:Item');
    expect((hotspots[0].data as { spreadCount: number }).spreadCount).toBe(2);
  });

  it('duplicate-documents groups identical operations', () => {
    const duplicates = rules['duplicate-documents'];
    expect(duplicates).toHaveLength(1);
    expect((duplicates[0].data as { members: unknown[] }).members).toHaveLength(2);
  });

  it('operation-complexity ranks operations by depth and field count', () => {
    const complexity = rules['operation-complexity'];
    expect(complexity.length).toBe(fixture.operations.length);
    // Sorted descending by score.
    const scores = complexity.map((d) => (d.data as { score: number }).score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('type-size-hotspots is empty without --measure-types', () => {
    expect(rules['type-size-hotspots']).toHaveLength(0);
  });
});
