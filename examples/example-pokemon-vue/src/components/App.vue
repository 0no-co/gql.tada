<script setup lang="ts">
import { Client, cacheExchange, fetchExchange, provideClient } from "@urql/vue";
import PokemonList from "./PokemonList.vue";

const client = new Client({
  url: "https://trygql.formidable.dev/graphql/basic-pokedex",
  exchanges: [cacheExchange, fetchExchange],
});

provideClient(client);
</script>
<template>
  <PokemonList />
</template>