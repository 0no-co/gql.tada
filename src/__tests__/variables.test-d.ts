import { expectTypeOf, test } from 'vitest';
import { simpleIntrospection } from './fixtures/simpleIntrospection';
import { parseDocument } from '../parser';
import { Introspection } from '../introspection';
import { Variables } from '../variables';

type Intro = Introspection<typeof simpleIntrospection>;

test('parses document-variables correctly', () => {
  const query = `
    mutation ($id: ID!) {
      toggleTodo { id }
    }
  `;

  type doc = parseDocument<typeof query>;
  type variables = Variables<doc, Intro>;

  expectTypeOf<variables>().toEqualTypeOf<{ id: string | number }>();
});

test('works for input-objects', () => {
  const query = `
    mutation ($id: ID!, $input: TodoPayload!) {
      toggleTodo (id: $id input: $input) { id }
    }
  `;

  type doc = parseDocument<typeof query>;
  type variables = Variables<doc, Intro>;

  expectTypeOf<variables>().toEqualTypeOf<{
    id: string | number;
    input: { title: string; complete: boolean | null };
  }>();
});

test('allows optionals for default values', () => {
  const query = `
    mutation ($id: ID! = "default") {
      toggleTodo (id: $id) { id }
    }
  `;

  type doc = parseDocument<typeof query>;
  type variables = Variables<doc, Intro>;

  expectTypeOf<variables>().toEqualTypeOf<{ id?: string | number | undefined }>();
  expectTypeOf<variables['id']>().toEqualTypeOf<string | number | undefined>();
});
