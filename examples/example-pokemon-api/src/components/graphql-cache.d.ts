/* eslint-disable */
/* prettier-ignore */
import type { TadaDocumentNode, $tada } from 'gql.tada';
import { initGraphQLTada } from 'gql.tada';
import type { Test } from '../Test';

declare module 'gql.tada' {
 interface setupCache {
    "\n  fragment PokemonItem on Pokemon {\n    id\n    name\n  }\n":
      TadaDocumentNode<{ id: string; name: string; }, {}, { fragment: "PokemonItem"; on: "Pokemon"; masked: true; }>;
    "\n  query Pokemons ($limit: Int = 10) {\n    pokemons(limit: $limit) {\n      id\n      ...PokemonItem\n    }\n  }\n":
      TadaDocumentNode<{ pokemons: ({ id: string; [$tada.fragmentRefs]: { PokemonItem: "Pokemon"; }; } | null)[] | null; }, { limit?: number | null | undefined; }, void>;
  }
}
