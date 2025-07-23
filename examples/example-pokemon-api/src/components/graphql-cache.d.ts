/* eslint-disable */
/* prettier-ignore */
import type { TadaDocumentNode, $tada } from 'gql.tada';

declare module 'gql.tada' {
 interface setupCache {
    // src/components/PokemonItem.tsx: 9c55ed9be388cc44
    "\n  fragment PokemonItem on Pokemon {\n    id\n    name\n  }\n":
      TadaDocumentNode<{ id: string; name: string; }, {}, { fragment: "PokemonItem"; on: "Pokemon"; masked: true; }>;
    // src/components/PokemonList.tsx: 1688b4723a61dbee
    "\n  query Pokemons ($limit: Int = 10) {\n    pokemons(limit: $limit) {\n      id\n      ...PokemonItem\n    }\n  }\n":
      TadaDocumentNode<{ pokemons: ({ id: string; [$tada.fragmentRefs]: { PokemonItem: "Pokemon"; }; } | null)[] | null; }, { limit?: number | null | undefined; }, void>;

  }
}
