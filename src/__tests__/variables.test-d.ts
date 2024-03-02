import { describe, it, expectTypeOf } from 'vitest';
import type { simpleSchema as schema } from './fixtures/simpleSchema';
import type { parseDocument } from '../parser';
import type { getVariablesType, getScalarType } from '../variables';

describe('getVariablesType', () => {
  it('parses document-variables correctly', () => {
    const query = `
      mutation ($id: ID!) {
        toggleTodo { id }
      }
    `;

    type doc = parseDocument<typeof query>;
    type variables = getVariablesType<doc, schema>;

    expectTypeOf<variables>().toEqualTypeOf<{ id: string | number }>();
  });

  it('works for input-objects', () => {
    const query = `
      mutation ($id: ID!, $input: TodoPayload!) {
        toggleTodo (id: $id input: $input) { id }
      }
    `;

    type doc = parseDocument<typeof query>;
    type variables = getVariablesType<doc, schema>;

    expectTypeOf<variables>().toEqualTypeOf<{
      id: string | number;
      input: { title: string; complete?: boolean | null; description: string };
    }>();
  });

  it('allows optionals for default values', () => {
    const query = `
      mutation ($id: ID! = "default") {
        toggleTodo (id: $id) { id }
      }
    `;

    type doc = parseDocument<typeof query>;
    type variables = getVariablesType<doc, schema>;

    expectTypeOf<variables>().toEqualTypeOf<{ id?: string | number | undefined }>();
    expectTypeOf<variables['id']>().toEqualTypeOf<string | number | undefined>();
  });

  it('allows optionals for default values inside input-objects', () => {
    const query = `
      mutation ($input: DefaultPayload!) {
        __typename
      }
    `;

    type doc = parseDocument<typeof query>;
    type variables = getVariablesType<doc, schema>;

    expectTypeOf<variables>().toEqualTypeOf<{
      input: {
        value?: string | null | undefined;
      };
    }>();
  });

  it('allows optionals for nullable values', () => {
    const query = `
      mutation ($id: ID) {
        toggleTodo (id: $id) { id }
      }
    `;

    type doc = parseDocument<typeof query>;
    type variables = getVariablesType<doc, schema>;

    expectTypeOf<variables>().toEqualTypeOf<{ id?: string | number | null | undefined }>();
    expectTypeOf<variables['id']>().toEqualTypeOf<string | number | null | undefined>();
  });
});

describe('getScalarType', () => {
  it('resolves to unknown for invalid types', () => {
    expectTypeOf<getScalarType<'invalid', schema>>().toEqualTypeOf<never>();
  });

  it('gets the type of a scalar', () => {
    expectTypeOf<getScalarType<'String', schema>>().toEqualTypeOf<string>();
  });

  it('gets the type of an enum', () => {
    expectTypeOf<getScalarType<'test', schema>>().toEqualTypeOf<'value' | 'more'>();
  });

  it('gets the type of an input object', () => {
    type expected = { title: string; complete?: boolean | null; description: string };
    expectTypeOf<getScalarType<'TodoPayload', schema>>().toEqualTypeOf<expected>();
  });
});
