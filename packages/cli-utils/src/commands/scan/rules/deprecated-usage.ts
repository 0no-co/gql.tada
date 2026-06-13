import type { ScanRule } from '../types';

export interface DeprecatedUsageData {
  reason?: string | undefined;
  count: number;
  operations: string[];
}

interface Accumulated {
  reason?: string | undefined;
  defIds: Set<string>;
}

/** Deprecated schema fields that are still selected, ranked by how many
 * operations reach them — the migration's remaining blast radius. */
export const deprecatedUsage: ScanRule<DeprecatedUsageData> = {
  name: 'deprecated-usage',
  description: 'Deprecated schema fields that are still in use.',
  create(context) {
    const byCoordinate = new Map<string, Accumulated>();

    return {
      visitor: {
        Field: {
          enter() {
            const parentType = context.getParentType();
            const fieldDef = context.getFieldDef();
            const definition = context.getCurrentDefinition();
            if (!parentType || !fieldDef || !definition) return;
            if (fieldDef.deprecationReason == null) return;

            const coordinate = `${parentType.name}.${fieldDef.name}`;
            let entry = byCoordinate.get(coordinate);
            if (!entry) {
              byCoordinate.set(
                coordinate,
                (entry = { reason: fieldDef.deprecationReason ?? undefined, defIds: new Set() })
              );
            }
            entry.defIds.add(definition.id);
          },
        },
      },

      collect() {
        const operationIds = new Set(context.operations.map((op) => op.id));
        return [...byCoordinate.entries()]
          .map(([coordinate, entry]) => {
            const operations = new Set<string>();
            for (const defId of entry.defIds) {
              if (operationIds.has(defId)) operations.add(defId);
              else
                for (const id of context.getOperationsReachingFragment(defId)) operations.add(id);
            }
            return { coordinate, reason: entry.reason, operations: [...operations] };
          })
          .sort((a, b) => b.operations.length - a.operations.length)
          .map(({ coordinate, reason, operations }) => ({
            ref: { kind: 'field', coordinate },
            message: `${coordinate} is deprecated but used by ${operations.length} operation(s)`,
            weight: operations.length,
            data: { reason, count: operations.length, operations },
          }));
      },
    };
  },
};
