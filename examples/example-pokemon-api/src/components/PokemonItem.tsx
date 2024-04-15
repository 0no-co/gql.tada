import { FragmentOf, graphql, readFragment } from '../graphql';

export const PokemonItemFragment = graphql(`
  fragment PokemonItem on Pokemon {
    id
    name
    bla
    bli
    blu
  }
`);

interface Props {
  data: FragmentOf<typeof PokemonItemFragment> | null;
}

const PokemonItem = ({ data }: Props) => {
  const pokemon = readFragment(PokemonItemFragment, data);
  if (!pokemon) {
    return null;
  }

  return (
    <li>
      {pokemon.name}
    </li>
  );
};

export { PokemonItem };
