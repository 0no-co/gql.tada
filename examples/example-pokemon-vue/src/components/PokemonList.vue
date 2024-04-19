<script lang="ts" setup>
import PokemonItem from "./PokemonItem.vue";
import { usePokemonQuery } from "../queries";

const { data, fetching, error } = usePokemonQuery();
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