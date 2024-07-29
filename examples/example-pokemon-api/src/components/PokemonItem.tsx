import { FragmentOf, graphql, readFragment } from '../graphql';
import { Attack, AttackFragment } from './Attack';

export const PokemonItemFragment = graphql(
  `
    fragment PokemonItem on Pokemon {
      id
      name
      types
      attacks @include(if: $includeAttacks) {
        fast {
          ...AttackItem
        }
        special {
          ...AttackItem
        }
      }
    }
  `,
  [AttackFragment]
);

interface Props {
  data: FragmentOf<typeof PokemonItemFragment> | null;
}

const PokemonItem: React.FC<Props> = ({ data }) => {
  const pokemon = readFragment(PokemonItemFragment, data);
  if (!pokemon) {
    return null;
  }

  return (
    <li>
      <strong>{pokemon.name}</strong> ({pokemon.types?.join(', ')})
      {pokemon.attacks?.fast && (
        <details>
          <summary>Fast Attacks</summary>
          <ul>
            {pokemon.attacks.fast.map((attack, index) => (
              <li>
                <Attack data={attack} key={index} />
              </li>
            ))}
          </ul>
        </details>
      )}
      {pokemon.attacks?.special && (
        <details>
          <summary>Special Attacks</summary>
          <ul>
            {pokemon.attacks.special.map((attack, index) => (
              <li>
                <Attack data={attack} key={index} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
};

export { PokemonItem };
