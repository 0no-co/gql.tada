import { describe, it, expectTypeOf } from 'vitest';
import type { simpleIntrospection } from './fixtures/simpleIntrospection';
import type { simpleSchema } from './fixtures/simpleSchema';
import type { mapIntrospection, getScalarType, getScalarTypeNames } from '../introspection';

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

describe('getScalarType', () => {
  it('gets the type of a scalar', () => {
    expectTypeOf<getScalarType<simpleSchema, 'String'>>().toEqualTypeOf<string>();
  });

  it('gets the type of an enum', () => {
    expectTypeOf<getScalarType<simpleSchema, 'test'>>().toEqualTypeOf<'value' | 'more'>();
  });
});

describe('getScalarTypeNames', () => {
  it('gets the names of all scalars and enums', () => {
    type actual = getScalarTypeNames<simpleSchema>;
    expectTypeOf<actual>().toEqualTypeOf<'test' | 'ID' | 'String' | 'Boolean' | 'Int'>();
  });
});
