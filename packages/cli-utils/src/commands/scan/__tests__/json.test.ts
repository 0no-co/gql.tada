import { buildSchema } from 'graphql';
import { describe, it, expect } from 'vitest';

import { analyze } from '../analyze';
import { renderJson } from '../output/json';
import type { RawScanDocument, SchemaName } from '../types';

const schema = buildSchema(`
  type Query { pokemons(limit: Int): [Pokemon] }
  type Mutation { touch: Pokemon }
  type Pokemon { id: ID!  name: String! }
`);
const schemas = new Map<SchemaName, ReturnType<typeof buildSchema>>([[null, schema]]);

const doc = (document: string, filePath: string): RawScanDocument => ({
  schemaName: null,
  document,
  filePath,
  line: 7,
  col: 3,
});

describe('renderJson', () => {
  const { context, rules } = analyze({
    documents: [
      doc('query GetPokemons($limit: Int) { pokemons(limit: $limit) { id } }', '/p/list.ts'),
      doc('mutation Touch { touch { id } }', '/p/touch.ts'),
    ],
    schemas,
    imports: new Map(),
    warnings: [],
  });
  const output = JSON.parse(renderJson(context, rules));

  it('emits overview, operations, fragments, and rules', () => {
    expect(Object.keys(output)).toEqual([
      'version',
      'overview',
      'operations',
      'fragments',
      'rules',
    ]);
  });

  it('carries per-operation identity a consumer can answer questions from', () => {
    const op = output.operations.find((o: { name: string }) => o.name === 'GetPokemons');
    expect(op.kind).toBe('query'); // per-operation kind
    expect(op.loc).toEqual({ file: '/p/list.ts', line: 7, col: 3 }); // location
    expect(op.variables).toEqual(['limit']); // declared variables
    expect(typeof op.hash).toBe('string'); // hash → exact-duplicate detection

    const mutation = output.operations.find((o: { name: string }) => o.name === 'Touch');
    expect(mutation.kind).toBe('mutation');
  });
});
