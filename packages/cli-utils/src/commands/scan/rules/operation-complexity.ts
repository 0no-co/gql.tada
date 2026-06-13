import { isListType, getNullableType } from 'graphql';

import type { ScanRule, RuleDatapoint } from '../types';

/** Extra weight per list field — list selections drive response size / N+1 risk. */
const LIST_WEIGHT = 3;

export interface ComplexityData {
  /** Selection depth, expanded through fragment spreads. */
  depth: number;
  /** Field selections, expanded through fragment spreads. */
  fieldCount: number;
  /** How many of those selections return a list. */
  listFields: number;
  /** Combined cost score. */
  score: number;
}

/** Per-definition metrics gathered during traversal (own selections only). */
interface DefMetrics {
  schemaName: string | null;
  ownDepth: number;
  ownFieldCount: number;
  ownListFields: number;
  /** Fragment spreads with the selection-set depth they occur at. */
  spreads: { name: string; depth: number }[];
}

/** Operations ranked by cost, expanded through fragment spreads (an operation
 * that delegates to a big fragment is correctly counted as large). List fields
 * are weighted more heavily as a proxy for response size / N+1 risk. */
export const operationComplexity: ScanRule<ComplexityData> = {
  name: 'operation-complexity',
  description: 'Operations ranked by transitive selection depth, field count, and list fan-out.',
  create(context) {
    const byDef = new Map<string, DefMetrics>();
    let current: DefMetrics | null = null;
    let depth = 0;

    const startDefinition = () => {
      const definition = context.getCurrentDefinition();
      if (!definition) {
        current = null;
        return;
      }
      current = {
        schemaName: definition.schemaName,
        ownDepth: 0,
        ownFieldCount: 0,
        ownListFields: 0,
        spreads: [],
      };
      byDef.set(definition.id, current);
      depth = 0;
    };

    return {
      visitor: {
        OperationDefinition: { enter: startDefinition, leave: () => void (current = null) },
        FragmentDefinition: { enter: startDefinition, leave: () => void (current = null) },
        SelectionSet: {
          enter() {
            if (current && ++depth > current.ownDepth) current.ownDepth = depth;
          },
          leave() {
            if (current) depth--;
          },
        },
        Field: {
          enter() {
            const fieldDef = context.getFieldDef();
            if (!current || !fieldDef || fieldDef.name.startsWith('__')) return;
            current.ownFieldCount++;
            if (isListType(getNullableType(fieldDef.type))) current.ownListFields++;
          },
        },
        FragmentSpread: {
          enter(node) {
            if (current) current.spreads.push({ name: node.name.value, depth });
          },
        },
      },

      collect() {
        const fragments = context.getFragmentGraph();

        // Transitive selection depth, expanding spreads (memoised, cycle-guarded).
        const depthMemo = new Map<string, number>();
        const effectiveDepth = (defId: string, visiting: Set<string>): number => {
          const cached = depthMemo.get(defId);
          if (cached != null) return cached;
          const metrics = byDef.get(defId);
          if (!metrics) return 0;
          let result = metrics.ownDepth;
          for (const spread of metrics.spreads) {
            const fragmentId = fragments.resolve(metrics.schemaName, spread.name);
            if (!fragmentId || visiting.has(fragmentId)) continue;
            visiting.add(fragmentId);
            result = Math.max(result, spread.depth - 1 + effectiveDepth(fragmentId, visiting));
            visiting.delete(fragmentId);
          }
          depthMemo.set(defId, result);
          return result;
        };

        const datapoints: RuleDatapoint<ComplexityData>[] = context.operations.map((op) => {
          const own = byDef.get(op.id);
          let fieldCount = own?.ownFieldCount ?? 0;
          let listFields = own?.ownListFields ?? 0;
          for (const fragmentId of fragments.reachableFragments(op.id)) {
            const metrics = byDef.get(fragmentId);
            if (metrics) {
              fieldCount += metrics.ownFieldCount;
              listFields += metrics.ownListFields;
            }
          }
          const operationDepth = effectiveDepth(op.id, new Set());
          const score = fieldCount + operationDepth * operationDepth + listFields * LIST_WEIGHT;

          return {
            ref: { kind: 'operation', id: op.id },
            message: `${op.name || '(anonymous)'}: depth ${operationDepth}, ${fieldCount} fields (${listFields} list)`,
            weight: score,
            data: { depth: operationDepth, fieldCount, listFields, score },
          };
        });

        return datapoints.sort((a, b) => b.data.score - a.data.score);
      },
    };
  },
};
