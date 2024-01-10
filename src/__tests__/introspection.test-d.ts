import { test, expectTypeOf } from 'vitest';
import { simpleIntrospection } from './fixtures/simpleIntrospection';
import { simpleSchema } from './fixtures/simpleSchema';
import { mapIntrospection } from '../introspection';

test('prepares sample schema', () => {
  type expected = mapIntrospection<typeof simpleIntrospection>;
  expectTypeOf<expected>().toMatchTypeOf<simpleSchema>();
});

test('applies scalar types as appropriate', () => {
  type expected = mapIntrospection<typeof simpleIntrospection, { ID: 'ID' }>;

  type idScalar = expected['types']['ID']['type'];
  expectTypeOf<idScalar>().toEqualTypeOf<'ID'>();
});
