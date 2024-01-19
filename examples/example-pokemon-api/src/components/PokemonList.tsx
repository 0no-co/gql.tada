import { useQuery } from 'urql';
import { graphql } from '../graphql';

import { PokemonItem, PokemonItemFragment } from './PokemonItem';

const PokemonsQuery = graphql(`
  query Pokemons ($limit: Int = 10) {
    pokemons(limit: $limit) {
      id
      ...PokemonItem @mask_disable
      ...PokemonItem
    }
  }
`, [PokemonItemFragment]);

const PokemonList = () => {
  const [result] = useQuery({ query: PokemonsQuery });

  const { data, fetching, error } = result;

  if (error) {
    return (
      <>
        <h3>Oh no!</h3>
        <pre>{error.message}</pre>
      </>
    );
  } else if (fetching || !data) {
    return <h3>Loading...</h3>
  }

  return (
    <div>
      {data.pokemons ? (
        <ul>
          {data.pokemons.map((pokemon, index) => (
            <PokemonItem data={pokemon} key={pokemon?.id || index} />
          ))}
        </ul>
      ) : (
        <h3>Your Pokedex is empty.</h3>
      )}
    </div>
  );
};

export { PokemonList };
