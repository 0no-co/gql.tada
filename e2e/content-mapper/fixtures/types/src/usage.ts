import type { ResultOf } from 'gql.tada';
import { Pokemons } from './pokemons.graphql';

// Spread fragments are masked, like in documents written in TypeScript files
declare const data: ResultOf<typeof Pokemons>;
export const name: string = data.pokemons![0]!.name;
