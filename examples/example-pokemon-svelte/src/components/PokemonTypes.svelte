<script context="module" lang="ts">
  import type { FragmentOf } from "../graphql";
  import { graphql, readFragment } from "../graphql";

  export const pokemonTypesFragment = graphql(`
    fragment PokemonTypes on Pokemon {
      types
    }
  `);
</script>

<script lang="ts">
  export let data: FragmentOf<typeof PokemonTypesFragment> | null;
  const pokemon = readFragment(pokemonTypesFragment, data);
</script>

{#if pokemon.types}
  <div>
    <h2>Types</h2>
    <ul>
      {#each pokemon.types as type}
        <li>{type}</li>
      {/each}
    </ul>
  </div>
{/if}
