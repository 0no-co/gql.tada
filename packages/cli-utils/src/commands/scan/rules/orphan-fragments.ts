import type { ScanRule } from '../types';

export interface OrphanFragmentData {
  typeCondition: string;
  module: string;
}

/** Fragments that are defined but never spread by any operation or fragment. */
export const orphanFragments: ScanRule<OrphanFragmentData> = {
  name: 'orphan-fragments',
  description: 'Fragments that are defined but never used.',
  create(context) {
    const spreadIds = new Set<string>();
    const fragments = context.getFragmentGraph();

    return {
      visitor: {
        FragmentSpread: {
          enter(node) {
            const definition = context.getCurrentDefinition();
            if (!definition) return;
            const id = fragments.resolve(definition.schemaName, node.name.value);
            if (id) spreadIds.add(id);
          },
        },
      },

      collect() {
        return context.fragments
          .filter((fragment) => !spreadIds.has(fragment.id))
          .map((fragment) => ({
            ref: { kind: 'fragment', id: fragment.id },
            message: `Fragment '${fragment.name}' is never spread`,
            data: { typeCondition: fragment.typeCondition, module: fragment.module },
          }));
      },
    };
  },
};
