import { test, expectTypeOf } from 'vitest';
import { simpleIntrospection } from './fixtures/simpleIntrospection';
import { simpleSchema } from './fixtures/simpleSchema';
import { mapIntrospection } from '../introspection';

test('prepares sample schema', () => {
  type expected = mapIntrospection<typeof simpleIntrospection>;
  expectTypeOf<expected>().toMatchTypeOf<simpleSchema>();
});
