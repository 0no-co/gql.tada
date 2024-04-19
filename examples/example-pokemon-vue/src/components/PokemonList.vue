<script lang="ts" setup>
import { useQuery } from "@urql/vue";
import { graphql } from "../graphql";
import PokemonItem, { PokemonItemFragment } from "./PokemonItem.vue";

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

const { data, fetching, error } = useQuery({ query: PersistedQuery });
</script>
<template>
  <div>
    <div v-if="error">
      <h3>Oh no!</h3>
      <pre>{{ error.message }}</pre>
    </div>
    <h3 v-else-if="fetching">Loading...</h3>
    <ul v-else-if="data && data.pokemons">
      <PokemonItem
        v-for="(pokemon, index) in data.pokemons"
        :key="index"
        :data="pokemon"
      />
    </ul>
    <h3 v-else>Your Pokedex is empty.</h3>
  </div>
</template>
