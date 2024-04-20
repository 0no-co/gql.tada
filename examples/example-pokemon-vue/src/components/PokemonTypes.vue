<script lang="ts">
import { computed } from "vue";
import { FragmentOf, graphql, readFragment } from "../graphql";

export const pokemonTypesFragment = graphql(`
  fragment PokemonTypes on Pokemon {
    types
  }
`);
</script>
<script setup lang="ts">
const props = defineProps<{
  data: FragmentOf<typeof pokemonTypesFragment> | null;
}>();

const data = computed(() => readFragment(pokemonTypesFragment, props.data));
</script>
<template>
  <div>
    <h2>Types</h2>
    <ul>
      <li v-for="(type, i) in data?.types" :key="i">
        {{ type }}
      </li>
    </ul>
  </div>
</template>
