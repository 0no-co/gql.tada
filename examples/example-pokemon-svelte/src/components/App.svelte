<script lang="ts">
  import { Client, setContextClient, cacheExchange, fetchExchange } from "@urql/svelte";
  import PokemonList from "./PokemonList.svelte";

  setContextClient(new Client({
    url: "https://trygql.formidable.dev/graphql/basic-pokedex",
    exchanges: [cacheExchange, fetchExchange],
  }));
</script>

<PokemonList />
