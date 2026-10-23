import { initGraphQLTada, type IntrospectionOf } from 'gql.tada';

// Only the schema's *type* is imported, so no server code ends up in the client
import type { schema } from '../schema/index.ts';

export const graphql = initGraphQLTada<{
  introspection: IntrospectionOf<typeof schema>;
}>();

export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada';
export { readFragment } from 'gql.tada';
