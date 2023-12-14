import { test, expectTypeOf } from 'vitest';
import { simpleIntrospection } from './fixtures/simpleIntrospection';
import { simpleSchema } from './fixtures/simpleSchema';
import { Introspection } from '../introspection';

test('prepares sample schema', () => {
  type expected = Introspection<typeof simpleIntrospection>;
  expectTypeOf<expected>().toMatchTypeOf<simpleSchema>();
});
