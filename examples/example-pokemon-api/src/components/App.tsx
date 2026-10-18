import { cacheExchange } from '@urql/exchange-graphcache';
import { Client, Provider, fetchExchange } from 'urql';

import { graphcache } from '../graphcache';
import { PokemonList } from './PokemonList';

const client = new Client({
  url: 'https://trygql.formidable.dev/graphql/basic-pokedex',
  exchanges: [cacheExchange(graphcache), fetchExchange],
});

function App() {
  return (
    <Provider value={client}>
      <PokemonList />
    </Provider>
  );
}

export default App;
