import { assertType, test } from 'vitest';
import { Introspection } from '../introspection';
import { Document } from '../parser';
import { TypedDocument } from '../typed-document';
import { schema } from './introspection.test-d';

type Intro = Introspection<typeof schema>;
const any = {} as any;

test('parses simple documents correctly', () => {
  const query = `
    query { todos { id } }
  `;
  type doc = Document<typeof query>;
  type typedDoc = TypedDocument<doc, Intro>;

  const actual = any as typedDoc;

  assertType<{ todos: Array<{ id: string | number } | null> | null }>(actual);
});

test('parses enum values', () => {
  const query = `
    query { todos { id test } }
  `;
  type doc = Document<typeof query>;
  type typedDoc = TypedDocument<doc, Intro>;

  const actual = any as typedDoc;
  assertType<{ todos: Array<{ id: string | number; test: 'value' | 'more' } | null> | null }>(
    actual
  );
});

test('parses inline fragments correctly', () => {
  const query = `
    query { todos { ... on Todo { id text } complete } }
  `;
  type doc = Document<typeof query>;
  type typedDoc = TypedDocument<doc, Intro>;

  const actual = any as typedDoc;

  assertType<{
    todos: Array<{
      id: string | number;
      text: string | null;
      complete: boolean | null;
    } | null> | null;
  }>(actual);
});

test('parses fragments correctly', () => {
  const query = `
    query { todos { ...Fields complete } }

    fragment Fields on Todo { id text __typename }
  `;
  type doc = Document<typeof query>;
  type typedDoc = TypedDocument<doc, Intro>;

  const actual = any as typedDoc;

  assertType<{
    todos: Array<{
      id: string | number;
      text: string | null;
      complete: boolean | null;
      __typename: 'Todo';
    } | null> | null;
  }>(actual);
});

test('mixes inline fragments and fragments correctly', () => {
  const query = `
    query { todos { ...Fields ... on Todo { text } complete } }

    fragment Fields on Todo { id  __typename }
  `;
  type doc = Document<typeof query>;
  type typedDoc = TypedDocument<doc, Intro>;

  const actual = any as typedDoc;

  assertType<{
    todos: Array<{
      id: string | number;
      text: string | null;
      complete: boolean | null;
      __typename: 'Todo';
    } | null> | null;
  }>(actual);
});

test('parses unions correctly', () => {
  // TODO: spreading TodoFields2 here makes it fail miserably...
  const unionQuery = `
  query {
    latestTodo {
      ... on NoTodosError { message  __typename }
      ...TodoFields
    }
  }
  
  fragment TodoFields on Todo {
    id
    __typename
  }

  fragment TodoFields2 on Todo {
    text
    complete
    __typename
  }
`;

  type doc = Document<typeof unionQuery>;
  type typedDoc = TypedDocument<doc, Intro>;

  const actual = any as typedDoc;

  assertType<{
    latestTodo:
      | { message: String; __typename: 'NoTodosError' }
      | { id: string | Number; __typename: 'Todo' };
  }>(actual);
});
