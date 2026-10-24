import { readFragment } from 'gql.tada';
import type { ResultOf, VariablesOf } from 'gql.tada';
import { PokemonItem } from './PokemonItem.graphql';
import { Pokemons } from './pokemons.graphql';

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assert = <T extends true>(): T | void => undefined;

assert<Equals<VariablesOf<typeof Pokemons>, { limit?: number | null | undefined }>>();

declare const data: ResultOf<typeof Pokemons>;
const pokemon = data.pokemons![0]!;
assert<Equals<typeof pokemon.types, string[] | null>>();

// Fragment masking applies to fragments imported between .graphql files
const item = readFragment(PokemonItem, pokemon);
assert<Equals<typeof item, { id: string; name: string }>>();
