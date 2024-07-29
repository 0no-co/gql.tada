import { FragmentOf, graphql, readFragment } from '../graphql';

export const AttackFragment = graphql(`
  fragment AttackItem on Attack {
    name
    type
    damage
  }
`);

interface Props {
  data: FragmentOf<typeof AttackFragment> | null;
}

export const Attack: React.FC<Props> = ({ data }) => {
  const attack = readFragment(AttackFragment, data);
  if (!attack) {
    return null;
  }

  return (
    <span>
      {attack.name} ({attack.type}): {attack.damage} damage
    </span>
  );
};
