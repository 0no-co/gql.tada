import { test, expectTypeOf } from 'vitest';
import type { simpleIntrospection } from './fixtures/simpleIntrospection';
import type { simpleSchema } from './fixtures/simpleSchema';
import type { mapIntrospection } from '../introspection';

test('prepares sample schema', () => {
  type expected = mapIntrospection<typeof simpleIntrospection>;
  expectTypeOf<expected>().toMatchTypeOf<simpleSchema>();
});

test('applies scalar types as appropriate', () => {
  type expected = mapIntrospection<typeof simpleIntrospection, { ID: 'ID' }>;

  type idScalar = expected['types']['ID']['type'];
  expectTypeOf<idScalar>().toEqualTypeOf<'ID'>();
});
