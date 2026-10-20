import {
  initGraphQLTada,
  readFragment,
  type ResultOf,
  type VariablesOf,
  type FragmentOf,
} from '../../src/index';
import type { simpleIntrospection } from '../../src/__tests__/fixtures/simpleIntrospection';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
const graphql = initGraphQLTada<{ introspection: simpleIntrospection }>();
const staticFields = 'id text' as const;
const Todos = graphql(`query Todos { todos { ${staticFields} } }`);
export type NullableResult = Assert<
  Equal<ResultOf<typeof Todos>, { todos: ({ id: string; text: string } | null)[] | null }>
>;
export const validResult: ResultOf<typeof Todos> = { todos: [{ id: '1', text: 'native API' }] };
export const invalidResult: ResultOf<typeof Todos> = { todos: [{ id: '1', text: 1 }] };

const fields = graphql(`
  fragment Fields on Todo {
    id
    text
  }
`);
const masked = graphql(
  `
    query Masked($limit: Int, $required: ID!, $defaulted: Int! = 10) {
      todos(limit: $limit) {
        ...Fields
      }
    }
  `,
  [fields]
);
export type Variables = Assert<
  Equal<VariablesOf<typeof masked>, { limit?: number | null; required: string; defaulted?: number }>
>;
export function unmask(data: FragmentOf<typeof fields>) {
  // @ts-expect-error Masked fields cannot be read without readFragment.
  void data.text;
  return readFragment(fields, data);
}
export type UnmaskedResult = Assert<Equal<ReturnType<typeof unmask>, { id: string; text: string }>>;

const unmaskedFields = graphql(`
  fragment OpenFields on Todo @_unmask {
    id
    text
  }
`);
const open = graphql(
  `
    query Open {
      todos {
        ...OpenFields
      }
    }
  `,
  [unmaskedFields]
);
export type OpenResult = Assert<Equal<ResultOf<typeof open>, ResultOf<typeof Todos>>>;

const abstract = graphql(`
  query Abstract {
    itodo {
      __typename
      id
      ... on BigTodo {
        wallOfText
      }
      ... on SmallTodo {
        maxLength
      }
    }
  }
`);
export type AbstractResult = Assert<
  Equal<
    ResultOf<typeof abstract>,
    {
      itodo:
        | { __typename: 'BigTodo'; id: string; wallOfText: string | null }
        | { __typename: 'SmallTodo'; id: string; maxLength: number | null };
    }
  >
>;

export function rejectVariables(variables: VariablesOf<typeof masked>) {
  // @ts-expect-error A required variable cannot be omitted.
  const missing: VariablesOf<typeof masked> = {};
  // @ts-expect-error An Int variable does not accept a string.
  const invalid: VariablesOf<typeof masked> = { required: '1', limit: 'bad' };
  return [variables, missing, invalid];
}
