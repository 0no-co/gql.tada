<script lang="ts">
import { graphql } from "../graphql";

export const PokemonItemFragment = graphql(`
  fragment PokemonItem on Pokemon {
    id
    name
  }
`);
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
  <li v-if="pokemon">{{ pokemon.name }}</li>
</template>