import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql-env.d.ts';
import type { Test } from './Test';

export const graphql = initGraphQLTada<{
  introspection: introspection;
  // Add any additional types or configurations here
  scalars: {
    Test: Test;
  };
}>();

export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada';
export { readFragment } from 'gql.tada';
