import type { ScanRule } from '../types';

/** Fragments shared by at least this many definitions count as a hotspot. */
const MIN_SPREADS = 2;

export interface CouplingData {
  spreadCount: number;
  typeCondition: string;
}

/** Fragments spread by many definitions — changing them has a wide blast radius. */
export const couplingHotspots: ScanRule<CouplingData> = {
  name: 'coupling-hotspots',
  description: 'Fragments shared across many operations/fragments.',
  create(context) {
    const counts = new Map<string, number>();

    return {
      visitor: {
        FragmentSpread: {
          enter(node) {
            const definition = context.getCurrentDefinition();
            if (!definition) return;
            const fragment = context.getFragment(definition.schemaName, node.name.value);
            if (fragment) counts.set(fragment.id, (counts.get(fragment.id) || 0) + 1);
          },
        },
      },

      collect() {
        const byId = new Map(context.fragments.map((fragment) => [fragment.id, fragment]));
        return [...counts.entries()]
          .filter(([, spreadCount]) => spreadCount >= MIN_SPREADS)
          .sort((a, b) => b[1] - a[1])
          .flatMap(([id, spreadCount]) => {
            const fragment = byId.get(id);
            if (!fragment) return [];
            return [
              {
                ref: { kind: 'fragment' as const, id },
                message: `Fragment '${fragment.name}' is spread by ${spreadCount} definitions`,
                data: { spreadCount, typeCondition: fragment.typeCondition },
              },
            ];
          });
      },
    };
  },
};
