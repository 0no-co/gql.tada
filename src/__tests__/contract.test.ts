import { describe, it, expect } from 'vitest';
import { introspectionFromSchema, parse, validate } from 'graphql';
import { minifyIntrospection, preprocessIntrospection } from '@gql.tada/internal';

import { schema, documents } from './fixtures/contractSchema';

describe('contract fixture', () => {
  it('matches the generated introspection type of its graphql-js schema', async () => {
    // contract.test-d.ts compares the hand-written contract against this generated type
    const introspection = minifyIntrospection(introspectionFromSchema(schema));
    const output = `export type contractIntrospection = ${preprocessIntrospection(introspection)};\n`;
    await expect(output).toMatchFileSnapshot('./fixtures/contractIntrospection.ts');
  });

  it.each(Object.entries(documents))('validates the %s document', (_name, document) => {
    expect(validate(schema, parse(document))).toEqual([]);
  });
});
