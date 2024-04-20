<script lang="ts">
import { graphql } from "../graphql";
import PokemonTypes, { pokemonTypesFragment } from "./PokemonTypes.vue";

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
<script setup lang="ts">
import { FragmentOf, readFragment } from "../graphql";
import { ref, computed } from "vue";

const props = defineProps<{
  data: FragmentOf<typeof PokemonItemFragment> | null;
}>();

const pokemon = computed(() => readFragment(PokemonItemFragment, props.data));
</script>
<template>
  <li v-if="pokemon">
    <p>{{ pokemon.name }}</p>
    <PokemonTypes :data="pokemon" />
  </li>
</template>