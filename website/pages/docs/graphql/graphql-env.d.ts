/** An IntrospectionQuery representation of your schema.
 *
 * @remarks
 * This is an introspection of your schema saved as a file by GraphQLSP.
 * It will automatically be used by `gql.tada` to infer the types of your GraphQL documents.
 * If you need to reuse this data or update your `scalars`, update `tadaOutputLocation` to
 * instead save to a .ts instead of a .d.ts file.
 */
export type introspection = {
  __schema: {
    queryType: {
      name: 'Query';
    };
    mutationType: {
      name: 'Mutation';
    };
    subscriptionType: null;
    types: [
      {
        kind: 'INPUT_OBJECT';
        name: 'SearchPokemon';
        inputFields: [
          {
            name: 'name';
            type: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          },
          {
            name: 'type';
            type: {
              kind: 'SCALAR';
              name: 'PokemonType';
              ofType: null;
            };
          },
        ];
      },
      {
        kind: 'OBJECT';
        name: 'Attack';
        fields: [
          {
            name: 'damage';
            type: {
              kind: 'SCALAR';
              name: 'Int';
              ofType: null;
            };
            args: [];
          },
          {
            name: 'name';
            type: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
            args: [];
          },
          {
            name: 'type';
            type: {
              kind: 'ENUM';
              name: 'PokemonType';
              ofType: null;
            };
            args: [];
          },
        ];
        interfaces: [];
      },
      {
        kind: 'SCALAR';
        name: 'Int';
      },
      {
        kind: 'SCALAR';
        name: 'String';
      },
      {
        kind: 'OBJECT';
        name: 'AttacksConnection';
        fields: [
          {
            name: 'fast';
            type: {
              kind: 'LIST';
              ofType: {
                kind: 'OBJECT';
                name: 'Attack';
                ofType: null;
              };
            };
            args: [];
          },
          {
            name: 'special';
            type: {
              kind: 'LIST';
              ofType: {
                kind: 'OBJECT';
                name: 'Attack';
                ofType: null;
              };
            };
            args: [];
          },
        ];
        interfaces: [];
      },
      {
        kind: 'OBJECT';
        name: 'EvolutionRequirement';
        fields: [
          {
            name: 'amount';
            type: {
              kind: 'SCALAR';
              name: 'Int';
              ofType: null;
            };
            args: [];
          },
          {
            name: 'name';
            type: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
            args: [];
          },
        ];
        interfaces: [];
      },
      {
        kind: 'OBJECT';
        name: 'Pokemon';
        fields: [
          {
            name: 'collected';
            type: {
              kind: 'SCALAR';
              name: 'Boolean';
              ofType: null;
            };
            args: [];
          },
          {
            name: 'attacks';
            type: {
              kind: 'OBJECT';
              name: 'AttacksConnection';
              ofType: null;
            };
            args: [];
          },
          {
            name: 'classification';
            type: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
            args: [];
          },
          {
            name: 'evolutionRequirements';
            type: {
              kind: 'LIST';
              ofType: {
                kind: 'OBJECT';
                name: 'EvolutionRequirement';
                ofType: null;
              };
            };
            args: [];
          },
          {
            name: 'evolutions';
            type: {
              kind: 'LIST';
              ofType: {
                kind: 'OBJECT';
                name: 'Pokemon';
                ofType: null;
              };
            };
            args: [];
          },
          {
            name: 'fleeRate';
            type: {
              kind: 'SCALAR';
              name: 'Float';
              ofType: null;
            };
            args: [];
          },
          {
            name: 'height';
            type: {
              kind: 'OBJECT';
              name: 'PokemonDimension';
              ofType: null;
            };
            args: [];
          },
          {
            name: 'id';
            type: {
              kind: 'NON_NULL';
              ofType: {
                kind: 'SCALAR';
                name: 'ID';
                ofType: null;
              };
            };
            args: [];
          },
          {
            name: 'maxCP';
            type: {
              kind: 'SCALAR';
              name: 'Int';
              ofType: null;
            };
            args: [];
          },
          {
            name: 'maxHP';
            type: {
              kind: 'SCALAR';
              name: 'Int';
              ofType: null;
            };
            args: [];
          },
          {
            name: 'name';
            type: {
              kind: 'NON_NULL';
              ofType: {
                kind: 'SCALAR';
                name: 'String';
                ofType: null;
              };
            };
            args: [];
          },
          {
            name: 'resistant';
            type: {
              kind: 'LIST';
              ofType: {
                kind: 'ENUM';
                name: 'PokemonType';
                ofType: null;
              };
            };
            args: [];
          },
          {
            name: 'types';
            type: {
              kind: 'LIST';
              ofType: {
                kind: 'ENUM';
                name: 'PokemonType';
                ofType: null;
              };
            };
            args: [];
          },
          {
            name: 'weaknesses';
            type: {
              kind: 'LIST';
              ofType: {
                kind: 'ENUM';
                name: 'PokemonType';
                ofType: null;
              };
            };
            args: [];
          },
          {
            name: 'weight';
            type: {
              kind: 'OBJECT';
              name: 'PokemonDimension';
              ofType: null;
            };
            args: [];
          },
        ];
        interfaces: [];
      },
      {
        kind: 'SCALAR';
        name: 'Float';
      },
      {
        kind: 'SCALAR';
        name: 'ID';
      },
      {
        kind: 'OBJECT';
        name: 'PokemonDimension';
        fields: [
          {
            name: 'maximum';
            type: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
            args: [];
          },
          {
            name: 'minimum';
            type: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
            args: [];
          },
        ];
        interfaces: [];
      },
      {
        kind: 'ENUM';
        name: 'PokemonType';
        enumValues: [
          {
            name: 'Bug';
          },
          {
            name: 'Dark';
          },
          {
            name: 'Dragon';
          },
          {
            name: 'Electric';
          },
          {
            name: 'Fairy';
          },
          {
            name: 'Fighting';
          },
          {
            name: 'Fire';
          },
          {
            name: 'Flying';
          },
          {
            name: 'Ghost';
          },
          {
            name: 'Grass';
          },
          {
            name: 'Ground';
          },
          {
            name: 'Ice';
          },
          {
            name: 'Normal';
          },
          {
            name: 'Poison';
          },
          {
            name: 'Psychic';
          },
          {
            name: 'Rock';
          },
          {
            name: 'Steel';
          },
          {
            name: 'Water';
          },
        ];
      },
      {
        kind: 'OBJECT';
        name: 'Query';
        fields: [
          {
            name: 'pokemon';
            type: {
              kind: 'OBJECT';
              name: 'Pokemon';
              ofType: null;
            };
            args: [
              {
                name: 'id';
                type: {
                  kind: 'NON_NULL';
                  ofType: {
                    kind: 'SCALAR';
                    name: 'ID';
                    ofType: null;
                  };
                };
              },
            ];
          },
          {
            name: 'pokemons';
            type: {
              kind: 'LIST';
              ofType: {
                kind: 'OBJECT';
                name: 'Pokemon';
                ofType: null;
              };
            };
            args: [
              {
                name: 'limit';
                type: {
                  kind: 'SCALAR';
                  name: 'Int';
                  ofType: null;
                };
              },
              {
                name: 'skip';
                type: {
                  kind: 'SCALAR';
                  name: 'Int';
                  ofType: null;
                };
              },
            ];
          },
        ];
        interfaces: [];
      },
      {
        kind: 'OBJECT';
        name: 'Mutation';
        fields: [
          {
            name: 'markCollected';
            type: {
              kind: 'OBJECT';
              name: 'Pokemon';
              ofType: null;
            };
            args: [
              {
                name: 'id';
                type: {
                  kind: 'NON_NULL';
                  ofType: {
                    kind: 'SCALAR';
                    name: 'ID';
                    ofType: null;
                  };
                };
              },
            ];
          },
        ];
        interfaces: [];
      },
      {
        kind: 'SCALAR';
        name: 'Boolean';
      },
    ];
    directives: [];
  };
};

import * as gqlTada from 'gql.tada';

declare module 'gql.tada' {
  interface setupSchema {
    introspection: introspection;
  }
}
