import { expectTypeOf, test } from 'vitest';

import type { simpleSchema } from './fixtures/simpleSchema';
import type { parseDocument } from '../parser';
import type { mapIntrospection } from '../introspection';
import type { getDocumentType } from '../selection';

import type {
  $tada,
  decorateFragmentDef,
  getFragmentsOfDocumentsRec,
  makeFragmentDefDecoration,
} from '../namespace';

type schema = simpleSchema;

test('infers simple fields', () => {
  type query = parseDocument</* GraphQL */ `
    query { todos { id } }
  `>;

  type actual = getDocumentType<query, schema>;
  type expected = { todos: Array<{ id: string | number } | null> | null };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('infers unknown fields as `unknown`', () => {
  type query = parseDocument</* GraphQL */ `
    query { unknown, unknownObj { __typename } }
  `>;

  type actual = getDocumentType<query, schema>;
  type expected = { unknown: unknown; unknownObj: unknown };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('infers adjacent inline fragments', () => {
  type query = parseDocument</* GraphQL */ `
    query { todos { id ... on Todo { text } ... on Todo { complete } } }
  `>;

  type actual = getDocumentType<query, schema>;
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
  type query = parseDocument</* GraphQL */ `
    query { todos { myIdIsGreat: id } }
  `>;

  type actual = getDocumentType<query, schema>;
  type expected = {
    todos: Array<{ myIdIsGreat: string | number } | null> | null;
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('infers optional properties for @skip/@include', () => {
  type query = parseDocument</* GraphQL */ `
    query {
      todos {
        id @skip(if: false)
        __typename @test @include(if: false)
      }
    }
  `>;

  type actual = getDocumentType<query, schema>;
  type expected = {
    todos: Array<{
      id?: string | number | undefined;
      __typename?: 'Todo';
    } | null> | null;
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('infers enum values', () => {
  type query = parseDocument</* GraphQL */ `
    query { todos { id test } }
  `>;

  type actual = getDocumentType<query, schema>;
  type expected = {
    todos: Array<{ id: string | number; test: 'value' | 'more' | null } | null> | null;
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('infers fragment spreads', () => {
  type query = parseDocument</* GraphQL */ `
    query { todos { ...Fields complete } }
    fragment Fields on Todo { id text __typename }
  `>;

  type actual = getDocumentType<query, schema>;
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

test('infers fragment spreads for fragment refs', () => {
  type fragment = parseDocument</* GraphQL */ `
    fragment Fields on Query { __typename }
  `>;

  type query = parseDocument</* GraphQL */ `
    query { ...Fields }
  `>;

  type extraFragments = getFragmentsOfDocumentsRec<
    [makeFragmentDefDecoration<decorateFragmentDef<fragment>>]
  >;

  type actual = getDocumentType<query, schema, extraFragments>;

  type expected = {
    [$tada.fragmentRefs]?: {
      Fields: extraFragments['Fields'][$tada.fragmentId];
    };
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('marks undefined fragments with special fragment ref error', () => {
  type query = parseDocument</* GraphQL */ `
    query { ...Fields }
  `>;

  type actual = getDocumentType<query, schema>;

  type expected = {
    [$tada.fragmentRefs]?: {
      Fields: 'Undefined Fragment';
    };
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('infers inline fragments and fragment spreads', () => {
  type query = parseDocument</* GraphQL */ `
    query { todos { ...Fields ... on Todo { text } complete } }
    fragment Fields on Todo { id  __typename }
  `>;

  type actual = getDocumentType<query, schema>;
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
  type query = parseDocument</* GraphQL */ `
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

  type actual = getDocumentType<query, schema>;
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
  type query = parseDocument</* GraphQL */ `
    mutation ($id: ID!, $input: TodoPayload!) {
      toggleTodo (id: $id input: $input) { id }
    }
  `>;

  type actual = getDocumentType<query, schema>;
  type expected = {
    toggleTodo: { id: string | number } | null;
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('infers unions and interfaces correctly', () => {
  type query = parseDocument</* GraphQL */ `
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

  type actual = getDocumentType<query, schema>;
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

test('infers queries from GitHub introspection schema', () => {
  type schema = mapIntrospection<
    typeof import('./fixtures/githubIntrospection').githubIntrospection
  >;

  type repositories = parseDocument</* GraphQL */ `
    query ($org: String!, $repo: String!) {
      repository(owner: $org, name: $repo) {
        id
      }
    }
  `>;

  type actual = getDocumentType<repositories, schema>;

  type expected = {
    repository: {
      id: string | number;
    } | null;
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});

test('creates a type for a given fragment', () => {
  type fragment = parseDocument<`
    fragment Fields on Todo {
      id
      text
      complete
      __typename
    }
  `>;

  type actual = getDocumentType<fragment, schema>;

  type expected = {
    __typename: 'Todo';
    id: string | number;
    text: string;
    complete: boolean | null;
  };

  expectTypeOf<expected>().toEqualTypeOf<actual>();
});
