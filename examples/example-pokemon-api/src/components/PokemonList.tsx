import { useQuery } from 'urql';
import { graphql } from '../graphql';

import { PokemonItem, PokemonItemFragment } from './PokemonItem';

const PokemonsQuery = graphql(`
  query Pokemons ($limit: Int = 10) {
    pokemons(limit: $limit) {
      id
      ...PokemonItem
    }
  }
`, [PokemonItemFragment]);

export const persisted = graphql.persisted<typeof PokemonsQuery>("sha256:fc073da8e9719deb51cdb258d7c35865708852c5ce9031a257588370d3cd42f3")

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
