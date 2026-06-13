import type { ScanRule, RuleDatapoint } from '../types';

export interface CrossFeatureData {
  definingArea: string;
  consumerAreas: string[];
  spreadCount: number;
}

/** Fragments consumed across area boundaries — a quantified signal of coupling
 * between features. The weight is the number of distinct consuming areas. */
export const crossFeatureFragments: ScanRule<CrossFeatureData> = {
  name: 'cross-feature-fragments',
  description: 'Fragments spread across multiple areas of the codebase.',
  create(context) {
    // fragment id -> areas of the definitions that spread it
    const consumerAreas = new Map<string, Set<string>>();
    const spreadCount = new Map<string, number>();

    const graph = context.getModuleGraph();

    return {
      visitor: {
        FragmentSpread: {
          enter(node) {
            const definition = context.getCurrentDefinition();
            if (!definition) return;
            const fragment = context.getFragment(definition.schemaName, node.name.value);
            if (!fragment) return;
            let areas = consumerAreas.get(fragment.id);
            if (!areas) consumerAreas.set(fragment.id, (areas = new Set()));
            areas.add(graph.areaOf(definition.module));
            spreadCount.set(fragment.id, (spreadCount.get(fragment.id) || 0) + 1);
          },
        },
      },

      collect() {
        const byId = new Map(context.fragments.map((fragment) => [fragment.id, fragment]));
        const datapoints: RuleDatapoint<CrossFeatureData>[] = [];
        for (const [id, areas] of consumerAreas) {
          const fragment = byId.get(id);
          if (!fragment) continue;
          const definingArea = graph.areaOf(fragment.module);
          // Areas other than where the fragment itself lives.
          const externalAreas = [...areas].filter((area) => area !== definingArea).sort();
          if (!externalAreas.length) continue;

          datapoints.push({
            ref: { kind: 'fragment' as const, id },
            message: `Fragment '${fragment.name}' (${definingArea}) is consumed by ${externalAreas.length} other area(s)`,
            weight: externalAreas.length,
            data: {
              definingArea,
              consumerAreas: [...areas].sort(),
              spreadCount: spreadCount.get(id) || 0,
            },
          });
        }
        return datapoints.sort((a, b) => (b.weight || 0) - (a.weight || 0));
      },
    };
  },
};
