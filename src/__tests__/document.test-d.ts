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

test('parses adjacent fragments correctly', () => {
  const query = `
    query { todos { ... on Todo { id } ... on Todo { text } ... on Todo { complete } } }
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

test('parses simple documents with aliases correctly', () => {
  const query = `
    query { todos { myIdIsGreat: id } }
  `;
  type doc = Document<typeof query>;
  type typedDoc = TypedDocument<doc, Intro>;

  const actual = any as typedDoc;

  assertType<{ todos: Array<{ myIdIsGreat: string | number } | null> | null }>(actual);
});

test('nulls when we have a skip directive', () => {
  const query = `
    query { todos { id @skip(if: false) __typename @test @skip(if: false) } }
  `;
  type doc = Document<typeof query>;
  type typedDoc = TypedDocument<doc, Intro>;

  const actual = any as typedDoc;

  assertType<{
    todos: Array<{ id: string | number | undefined; __typename: 'Todo' | undefined } | null> | null;
  }>(actual);
});

test('parses enum values', () => {
  const query = `
    query { todos { id test } }
  `;
  type doc = Document<typeof query>;
  type typedDoc = TypedDocument<doc, Intro>;

  const actual = any as typedDoc;
  assertType<{
    todos: Array<{ id: string | number; test: 'value' | 'more' | null } | null> | null;
  }>(actual);
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
  const unionQuery = `
  query {
    latestTodo {
      ...TodoFields
      ... on NoTodosError { message  __typename }
      ...TodoFields2
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
      | {
          id: string | Number;
          text: string | null;
          complete: boolean | null;
          __typename: 'Todo';
        };
  }>(actual);
});

test('works with mutations', () => {
  const query = `
      mutation X ($id: ID!) {
        toggleTodo { id }
      }
    `;
  type doc = Document<typeof query>;
  type typedDoc = TypedDocument<doc, Intro>;

  const actual = any as typedDoc;

  assertType<{ toggleTodo: { id: string | number } | null }>(actual);
});
