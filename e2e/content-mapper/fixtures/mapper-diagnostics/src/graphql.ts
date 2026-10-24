import { initGraphQLTada } from 'gql.tada';
import type { introspection } from '../schema.graphql';

export const graphql = initGraphQLTada<{ introspection: introspection }>();
