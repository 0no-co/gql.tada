import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, afterAll } from 'vitest';
import { buildSchema, getIntrospectionQuery, graphqlSync } from 'graphql';

import { createSchemaFingerprinter } from '../fingerprint';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gql-tada-fingerprint-'));
afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

const baseSchema = `
  type Query { a: A, other: Int, u: U, i: I }
  type A implements I { id: ID!, e: E, b: B, unused: Int }
  type B { x: String }
  type C implements I { id: ID! }
  interface I { id: ID! }
  union U = A | C
  enum E { ONE TWO }
  input In { f: String!, g: Int = 1, n: Nested }
  input Nested { z: E }
  type Mutation { m(in: In): Int }
`;

const query = `query Q { a { id e b { x } } u { __typename ... on A { id } } i { id } }`;
const mutation = `mutation M($in: In) { m(in: $in) }`;

let fileCount = 0;
const fingerprint = (sdl: string, document: string): string => {
  const fileName = `schema-${fileCount++}.graphql`;
  fs.writeFileSync(path.join(tmpDir, fileName), sdl);
  const fingerprinter = createSchemaFingerprinter(fileName, tmpDir, 'fallback');
  return typeof fingerprinter === 'function' ? fingerprinter(document) : fingerprinter;
};

describe('createSchemaFingerprinter', () => {
  it.each([
    ['an unrelated root field is added', baseSchema.replace('other: Int', 'other: Int, x: Int')],
    ['an unselected field is added', baseSchema.replace('unused: Int', 'unused: Int, more: Int')],
    ['an unselected field changes', baseSchema.replace('unused: Int', 'unused: String')],
    ['an unrelated input changes', baseSchema.replace('g: Int = 1', 'g: Int')],
    ['enum values are reordered', baseSchema.replace('ONE TWO', 'TWO ONE')],
  ])('keeps the fingerprint when %s', (_, sdl) => {
    expect(fingerprint(sdl, query)).toBe(fingerprint(baseSchema, query));
  });

  it.each([
    ['a selected field changes nullability', baseSchema.replace('id: ID!, e', 'id: ID, e')],
    ['an enum value is added', baseSchema.replace('ONE TWO', 'ONE TWO THREE')],
    ['a union member is added', baseSchema.replace('U = A | C', 'U = A | C | B')],
    [
      'an interface gains an implementation',
      baseSchema.replace('type B {', 'type B implements I { id: ID!,'),
    ],
    ['a selected field is removed', baseSchema.replace(' b: B,', '')],
  ])('changes the fingerprint when %s', (_, sdl) => {
    expect(fingerprint(sdl, query)).not.toBe(fingerprint(baseSchema, query));
  });

  it.each([
    ['a nested input enum changes', baseSchema.replace('ONE TWO', 'ONE TWO THREE')],
    ['an input default is removed', baseSchema.replace('g: Int = 1', 'g: Int')],
    ['an input field is added', baseSchema.replace('f: String!,', 'f: String!, h: Int,')],
  ])('changes the variables fingerprint when %s', (_, sdl) => {
    expect(fingerprint(sdl, mutation)).not.toBe(fingerprint(baseSchema, mutation));
  });

  it('supports introspection JSON schemas', () => {
    const introspection = graphqlSync({
      schema: buildSchema(baseSchema),
      source: getIntrospectionQuery(),
    });
    fs.writeFileSync(path.join(tmpDir, 'schema.json'), JSON.stringify(introspection));
    const fingerprinter = createSchemaFingerprinter('schema.json', tmpDir, 'fallback');
    expect(typeof fingerprinter).toBe('function');
    expect((fingerprinter as (text: string) => string)(query)).toBe(fingerprint(baseSchema, query));
  });

  it('falls back for remote schemas', () => {
    expect(createSchemaFingerprinter('https://example.com/graphql', tmpDir, 'fallback')).toBe(
      'fallback'
    );
  });

  it('falls back when the schema or document cannot be parsed', () => {
    expect(fingerprint('type Query {', query)).toBe('fallback');
    expect(fingerprint(baseSchema, 'query {')).toBe('fallback');
  });
});
