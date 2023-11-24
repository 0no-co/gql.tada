import { expectTypeOf, test } from 'vitest';
import { Introspection } from '../introspection';
import { Document } from '../parser';
import { TypedDocument } from '../typed-document';
import { schema } from './introspection.test-d';

type Intro = Introspection<typeof schema>;

test('infers simple fields', () => {
  type query = Document</* GraphQL */ `
    query { todos { id } }
  `>;

  type actual = TypedDocument<query, Intro>;
  type expected = { todos: Array<{ id: string | number } | null> | null };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('infers adjacent inline fragments', () => {
  type query = Document</* GraphQL */ `
    query { todos { id ... on Todo { text } ... on Todo { complete } } }
  `>;

  type actual = TypedDocument<query, Intro>;
  type expected = {
    todos: Array<{
      id: string | number;
      text: string;
      complete: boolean | null;
    } | null> | null;
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('infers aliased fields', () => {
  type query = Document</* GraphQL */ `
    query { todos { myIdIsGreat: id } }
  `>;

  type actual = TypedDocument<query, Intro>;
  type expected = {
    todos: Array<{ myIdIsGreat: string | number } | null> | null;
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('infers optional properties for @skip/', () => {
  type query = Document</* GraphQL */ `
    query {
      todos {
        id @skip(if: false)
        __typename @test @include(if: false)
      }
    }
  `>;

  type actual = TypedDocument<query, Intro>;
  type expected = {
    todos: Array<{
      id?: string | number | undefined;
      __typename?: 'Todo';
    } | null> | null;
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('infers enum values', () => {
  type query = Document</* GraphQL */ `
    query { todos { id test } }
  `>;

  type actual = TypedDocument<query, Intro>;
  type expected = {
    todos: Array<{ id: string | number; test: 'value' | 'more' | null } | null> | null;
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('infers fragment spreads', () => {
  type query = Document</* GraphQL */ `
    query { todos { ...Fields complete } }
    fragment Fields on Todo { id text __typename }
  `>;

  type actual = TypedDocument<query, Intro>;
  type expected = {
    todos: Array<{
      __typename: 'Todo';
      id: string | number;
      text: string;
      complete: boolean | null;
    } | null> | null;
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('infers inline fragments and fragment spreads', () => {
  type query = Document</* GraphQL */ `
    query { todos { ...Fields ... on Todo { text } complete } }
    fragment Fields on Todo { id  __typename }
  `>;

  type actual = TypedDocument<query, Intro>;
  type expected = {
    todos: Array<{
      __typename: 'Todo';
      id: string | number;
      text: string;
      complete: boolean | null;
    } | null> | null;
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('infers fragment spreads on unions', () => {
  type query = Document</* GraphQL */ `
    query {
      latestTodo {
        __typename
        ...TodoFields
        ...TodoFields2
        ... on NoTodosError { message  __typename }
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
  `>;

  type actual = TypedDocument<query, Intro>;
  type expected = {
    latestTodo:
      | { message: string; __typename: 'NoTodosError' }
      | {
          __typename: 'Todo';
          id: string | number;
          text: string;
          complete: boolean | null;
        };
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();

  const data: actual = {} as any;
  if (data.latestTodo.__typename === 'NoTodosError') {
    data.latestTodo.message satisfies string;
  } else if (data.latestTodo.__typename === 'Todo') {
    data.latestTodo.id satisfies string | number;
  }
});

test('infers mutations', () => {
  type query = Document</* GraphQL */ `
    mutation ($id: ID!, $input: TodoPayload!) {
      toggleTodo (id: $id input: $input) { id }
    }
  `>;

  type actual = TypedDocument<query, Intro>;
  type expected = {
    toggleTodo: { id: string | number } | null;
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('infers unions and interfaces correctly', () => {
  type query = Document</* GraphQL */ `
    query {
      test {
        __typename
        ...InterfaceFields
        ... on SmallTodo { text maxLength __typename }
        ... on BigTodo { wallOfText __typename }
      }
    }
    
    fragment InterfaceFields on ITodo {
      id
      __typename
    }
  `>;

  type actual = TypedDocument<query, Intro>;
  type expected = {
    test:
      | {
          __typename: 'SmallTodo';
          id: string | number;
          text: string;
          maxLength: number | null;
        }
      | {
          __typename: 'BigTodo';
          id: string | number;
          wallOfText: string | null;
        }
      | null;
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('infers queries from GitHub Introspection schema', () => {
  type githubIntrospection = import('./fixtures/githubIntrospection').GitHubIntrospection;

  type repositories = Document</* GraphQL */ `
    query ($org: String!, $repo: String!) {
      repository(owner: $org, name: $repo) {
        id
      }
    }
  `>;

  type actual = TypedDocument<repositories, githubIntrospection>;

  type expected = {
    repository: {
      id: string | number;
    } | null;
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});
