<script context="module" lang="ts">
  import { graphql } from "../graphql";
  import PokemonItem, { PokemonItemFragment } from "./PokemonItem.svelte";

  const PokemonsQuery = graphql(`
    query Pokemons ($limit: Int = 10) {
      pokemons(limit: $limit) {
        id
        ...PokemonItem
      }
    }
  `, [PokemonItemFragment]);

  const PersistedQuery = graphql.persisted(
    "sha256:fc073da8e9719deb51cdb258d7c35865708852c5ce9031a257588370d3cd42f3",
    PokemonsQuery,
  );
</script>

<script lang="ts">
  import { getContextClient, queryStore } from "@urql/svelte";

  $: result = queryStore({
    client: getContextClient(),
    query: PersistedQuery
  });
</script>

<div>
  {#if $result.fetching}
    <h3>Loading...</h3>
  {:else if $result.error}
    <div>
      <h3>Oh no!</h3>
      <pre>{$result.error.message}</pre>
    </div>
  {:else if $result.data.pokemons}
    <ul>
      {#each $result.data.pokemons as pokemon}
        <PokemonItem data={pokemon} />
      {/each}
    </ul>
  {:else}
    <h3>Your Pokedex is empty.</h3>
  {/if}
</div>
