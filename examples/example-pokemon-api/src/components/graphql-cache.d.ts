/* eslint-disable */
/* prettier-ignore */
import type { TadaDocumentNode, $tada } from 'gql.tada';
import type { Test } from '../Test';

declare module 'gql.tada' {
 interface setupCache {
    // src/components/PokemonItem.tsx: 15345b224329e85f
    "\n  fragment PokemonItem on Pokemon {\n    id\n    name\n  }\n":
      TadaDocumentNode<{ id: string; name: Test; }, {}, { fragment: "PokemonItem"; on: "Pokemon"; masked: true; }>;
    // src/components/PokemonList.tsx: 09e09a474c68d63a
    "\n  query Pokemons ($limit: Int = 10) {\n    pokemons(limit: $limit) {\n      id\n      ...PokemonItem\n    }\n  }\n":
      TadaDocumentNode<{ pokemons: ({ id: string; [$tada.fragmentRefs]: { PokemonItem: "Pokemon"; }; } | null)[] | null; }, { limit?: number | null | undefined; }, void>;

  }
}
