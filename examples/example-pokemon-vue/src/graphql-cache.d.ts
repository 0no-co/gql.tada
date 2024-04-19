/* eslint-disable */
/* prettier-ignore */
import type { TadaDocumentNode, $tada } from 'gql.tada';

declare module 'gql.tada' {
 interface setupCache {
    "\n      query Pokemons($limit: Int = 10) {\n        pokemons(limit: $limit) {\n          id\n          ...PokemonItem\n        }\n      }\n    ":
      TadaDocumentNode<{ pokemons: ({ [x: string]: any; } | null)[] | null; }, { limit?: number | null | undefined; }, void>;
    "\n  fragment PokemonItem on Pokemon {\n    id\n    name\n  }\n":
      TadaDocumentNode<{ name: string; id: string; }, {}, { fragment: "PokemonItem"; on: "Pokemon"; masked: true; }>;
  }
}
