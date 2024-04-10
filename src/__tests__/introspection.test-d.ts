import { describe, it, expectTypeOf } from 'vitest';
import type { simpleIntrospection } from './fixtures/simpleIntrospection';
import type { simpleSchema } from './fixtures/simpleSchema';
import type { mapIntrospection, addIntrospectionScalars } from '../introspection';

describe('mapIntrospection', () => {
  it('prepares sample schema', () => {
    type expected = mapIntrospection<simpleIntrospection>;
    expectTypeOf<simpleSchema>().toMatchTypeOf<expected>();
  });

  it('applies scalar types as appropriate', () => {
    type expected = addIntrospectionScalars<mapIntrospection<simpleIntrospection>, { ID: 'ID' }>;
    type idScalar = expected['types']['ID']['type'];
    expectTypeOf<idScalar>().toEqualTypeOf<'ID'>();
  });

  it('still uses default scalars when applying custom scalars', () => {
    type expected = addIntrospectionScalars<mapIntrospection<simpleIntrospection>, { ID: 'ID' }>;
    type intScalar = expected['types']['Int']['type'];
    expectTypeOf<intScalar>().toEqualTypeOf<number>();
  });

  it('allows enums to be remapped', () => {
    enum TestEnum {
      test = 'test',
      value = 'value',
    }
    type expected = addIntrospectionScalars<
      mapIntrospection<simpleIntrospection>,
      { test: TestEnum }
    >;
    type testEnum = expected['types']['test']['type'];
    expectTypeOf<testEnum>().toEqualTypeOf<TestEnum>();
  });
});
