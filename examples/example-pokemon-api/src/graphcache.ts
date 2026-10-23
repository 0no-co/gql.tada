import type { GraphCacheConfig } from 'gql.tada/addons/graphcache';
import type { graphql } from './graphql';

export const graphcache = {
  keys: {
    Pokemon: (data) => data.id || null,
    Attack: () => null,
    AttacksConnection: () => null,
    EvolutionRequirement: () => null,
    PokemonDimension: () => null,
  },
  resolvers: {
    Query: {
      pokemon(_parent, args) {
        return { __typename: 'Pokemon', id: args.id };
      },
    },
  },
} satisfies GraphCacheConfig<typeof graphql>;
