import { useQuery } from 'urql';
import { useState } from 'react';
import { graphql } from '../graphql';
import { PokemonItem, PokemonItemFragment } from './PokemonItem';

const PokemonsQuery = graphql(
  `
    query Pokemons($limit: Int = 10, $includeAttacks: Boolean = true) {
      pokemons(limit: $limit) {
        id
        ...PokemonItem
      }
    }
  `,
  [PokemonItemFragment]
);

const PersistedQuery = graphql.persisted(
  'sha256:73ed59135aef3618a4d63e8d22b603234af79820e9b5ce54c6b171c6f292ca5d',
  PokemonsQuery
);

const PokemonList = () => {
  const [limit, setLimit] = useState(10);
  const [includeAttacks, setIncludeAttacks] = useState(false);
  const [result] = useQuery({
    query: PersistedQuery,
    variables: {
      limit,
      includeAttacks,
    },
  });

  const { data, fetching, error } = result;

  if (error) {
    return (
      <>
        <h1>Oh no!</h1>
        <pre>{error.message}</pre>
      </>
    );
  } else if (fetching || !data) {
    return <p>Loading...</p>;
  }

  return (
    <main>
      <h1>Pokedex</h1>
      <fieldset>
        <legend>Query Settings</legend>
        <div>
          <label htmlFor="limit">Limit:</label>
          <select id="limit" onChange={(e) => setLimit(parseInt(e.target.value))}>
            {[10, 20, 50, 100].map((value) => (
              <option key={value} selected={limit === value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="includeAttacks">Include Attacks:</label>
          <input
            id="includeAttacks"
            type="checkbox"
            checked={includeAttacks}
            onChange={(e) => setIncludeAttacks(e.target.checked)}
          />
        </div>
      </fieldset>
      {data.pokemons ? (
        <ol>
          {data.pokemons.map((pokemon, index) => (
            <PokemonItem data={pokemon} key={pokemon?.id || index} />
          ))}
        </ol>
      ) : (
        <p>Your Pokedex is empty.</p>
      )}
    </main>
  );
};

export { PokemonList };
