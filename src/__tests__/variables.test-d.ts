import { expectTypeOf, assertType, test } from 'vitest';
import { simpleIntrospection } from './fixtures/simpleIntrospection';
import { Introspection } from '../introspection';
import { Document } from '../parser';
import { Variables } from '../typed-document/variables';

type Intro = Introspection<typeof simpleIntrospection>;
const any = {} as any;

test('parses document-variables correctly', () => {
  const query = `
    mutation ($id: ID!) {
      toggleTodo { id }
    }
  `;
  type doc = Document<typeof query>;
  type variables = Variables<doc, Intro>;

  const actual = any as variables;

  assertType<{ id: string | number }>(actual);
});

/*
test('works for input-bojects', () => {
  const query = `
  mutation ($id: ID!, $input: TodoPayload!) {
    toggleTodo (id: $id input: $input) { id }
  }
`;
  type doc = Document<typeof query>;
  type variables = Variables<doc, Intro>;

  const actual = any as variables;
  actual.input;

  assertType<{ id: string | number; input: { text: string; complete: boolean } }>(actual);
});
*/

test('allows optionals for default values', () => {
  const query = `
    mutation ($id: ID! = "default") {
      toggleTodo (id: $id) { id }
    }
  `;

  type doc = Document<typeof query>;
  type variables = Variables<doc, Intro>;

  expectTypeOf<variables>().toEqualTypeOf<{ id?: string | number | undefined }>();
  expectTypeOf<variables['id']>().toEqualTypeOf<string | number | undefined>();
});
