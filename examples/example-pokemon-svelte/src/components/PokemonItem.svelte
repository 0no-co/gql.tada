<script context="module" lang="ts">
  import type { FragmentOf } from "../graphql";
  import { graphql, readFragment } from "../graphql";
  import PokemonTypes, { pokemonTypesFragment } from "./PokemonTypes.svelte";

  export const PokemonItemFragment = graphql(
    `
      fragment PokemonItem on Pokemon {
        id
        name
        ...PokemonTypes
      }
    `,
    [pokemonTypesFragment]
  );
</script>

<script lang="ts">
  export let data: FragmentOf<typeof PokemonItemFragment> | null;
  const pokemon = readFragment(PokemonItemFragment, data);
</script>

<li v-if="pokemon">
  <p>{pokemon.name}</p>
  <PokemonTypes data={pokemon} />
</li>
