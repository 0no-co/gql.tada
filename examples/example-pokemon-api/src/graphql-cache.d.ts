import * as gqlTada from 'gql.tada';

declare module 'gql.tada' {
  interface SetupCache {
    '\r\n  fragment PokemonItem on Pokemon {\r\n    id\r\n    name\r\n  }\r\n': import('E:/gql.tada/dist/gql-tada').TadaDocumentNode<
      { [key: string]: any },
      { [key: string]: any },
      void
    >;
    '\r\n  query Pokemons ($limit: Int = 10) {\r\n    pokemons(limit: $limit) {\r\n      id\r\n      ...PokemonItem\r\n    }\r\n  }\r\n': import('E:/gql.tada/dist/gql-tada').TadaDocumentNode<
      { [key: string]: any },
      { [key: string]: any },
      void
    >;
  }
}
