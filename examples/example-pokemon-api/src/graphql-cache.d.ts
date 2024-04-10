import * as gqlTada from 'gql.tada';

declare module 'gql.tada' {
  interface Cache {
    properties: {
      '\r\n  fragment PokemonItem on Pokemon {\r\n    id\r\n    name\r\n  }\r\n': import('E:/gql.tada/dist/gql-tada').TadaDocumentNode<
        { name: string; id: string },
        {},
        { fragment: 'PokemonItem'; on: 'Pokemon'; masked: true }
      >;
      '\r\n  query Pokemons ($limit: Int = 10) {\r\n    pokemons(limit: $limit) {\r\n      id\r\n      ...PokemonItem\r\n    }\r\n  }\r\n': import('E:/gql.tada/dist/gql-tada').TadaDocumentNode<
        {
          pokemons:
            | ({ [$tada.fragmentRefs]: { PokemonItem: 'Pokemon' }; id: string } | null)[]
            | null;
        },
        { limit?: number | null | undefined },
        void
      >;
    };
  }
}
