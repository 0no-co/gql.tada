import type { ScanRule, RuleDatapoint } from '../types';

export interface FootprintData {
  fieldCount: number;
  /** Distinct schema coordinates the operation selects, sorted. */
  fields: string[];
}

/** The forward index: the full set of schema fields each operation selects,
 * including everything pulled in transitively through fragment spreads.
 * Complements `field-usage` (which is field → operations). */
export const operationFootprint: ScanRule<FootprintData> = {
  name: 'operation-footprint',
  description: 'Schema fields each operation selects, through fragments.',
  create(context) {
    // Coordinates selected within each definition's own selections.
    const fieldsByDef = new Map<string, Set<string>>();

    return {
      visitor: {
        Field: {
          enter() {
            const parentType = context.getParentType();
            const fieldDef = context.getFieldDef();
            const definition = context.getCurrentDefinition();
            if (!parentType || !fieldDef || !definition) return;
            if (fieldDef.name.startsWith('__')) return;
            let set = fieldsByDef.get(definition.id);
            if (!set) fieldsByDef.set(definition.id, (set = new Set()));
            set.add(`${parentType.name}.${fieldDef.name}`);
          },
        },
      },

      collect() {
        const fragments = context.getFragmentGraph();
        const idOf = (d: RuleDatapoint<FootprintData>) =>
          d.ref.kind === 'operation' ? d.ref.id : '';

        const datapoints: RuleDatapoint<FootprintData>[] = context.operations.map((op) => {
          const fields = new Set<string>(fieldsByDef.get(op.id));
          for (const fragmentId of fragments.reachableFragments(op.id)) {
            const fragmentFields = fieldsByDef.get(fragmentId);
            if (fragmentFields) for (const coordinate of fragmentFields) fields.add(coordinate);
          }
          const sorted = [...fields].sort();
          return {
            ref: { kind: 'operation', id: op.id },
            message: `${op.name || '(anonymous)'} selects ${sorted.length} field(s)`,
            weight: sorted.length,
            data: { fieldCount: sorted.length, fields: sorted },
          };
        });

        return datapoints.sort(
          (a, b) => b.data.fieldCount - a.data.fieldCount || idOf(a).localeCompare(idOf(b))
        );
      },
    };
  },
};
