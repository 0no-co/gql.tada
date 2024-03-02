import { describe, it, expectTypeOf } from 'vitest';
import type { simpleIntrospection } from './fixtures/simpleIntrospection';
import type { simpleSchema } from './fixtures/simpleSchema';
import type { mapIntrospection } from '../introspection';

describe('mapIntrospection', () => {
  it('prepares sample schema', () => {
    type expected = mapIntrospection<simpleIntrospection>;
    expectTypeOf<expected>().toMatchTypeOf<simpleSchema>();
  });

  it('applies scalar types as appropriate', () => {
    type expected = mapIntrospection<simpleIntrospection, { ID: 'ID' }>;

    type idScalar = expected['types']['ID']['type'];
    expectTypeOf<idScalar>().toEqualTypeOf<'ID'>();
  });
});
