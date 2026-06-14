import { isListType, getNullableType } from 'graphql';

import type { ScanRule, RuleDatapoint } from '../types';

/** Extra weight per list field — list selections drive response size / N+1 risk. */
const LIST_WEIGHT = 3;

export interface ComplexityData {
  /** Selection depth, expanded through fragment spreads. */
  depth: number;
  /** Number of distinct fields selected, expanded through fragment spreads. */
  fieldCount: number;
  /** How many of those distinct fields return a list. */
  listFields: number;
  /** The distinct schema coordinates selected (the operation's footprint). */
  fields: string[];
  /** Combined cost score. */
  score: number;
}

/** Per-definition metrics gathered during traversal (own selections only). */
interface DefMetrics {
  schemaName: string | null;
  ownDepth: number;
  /** Distinct coordinates selected directly in this definition. */
  fields: Set<string>;
  /** Subset of {@link fields} whose field returns a list. */
  listFields: Set<string>;
  /** Fragment spreads with the selection-set depth they occur at. */
  spreads: { name: string; depth: number }[];
}

/** Operations ranked by cost, expanded through fragment spreads (an operation
 * that delegates to a big fragment is correctly counted as large). Reports the
 * operation's full field footprint, its transitive depth, and how many of its
 * fields return lists (weighted more heavily as a proxy for response size /
 * N+1 risk). */
export const operationComplexity: ScanRule<ComplexityData> = {
  name: 'operation-complexity',
  description: 'Operations ranked by transitive footprint, depth, and list fan-out.',
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
        fields: new Set(),
        listFields: new Set(),
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
            const parentType = context.getParentType();
            const fieldDef = context.getFieldDef();
            if (!current || !parentType || !fieldDef || fieldDef.name.startsWith('__')) return;
            const coordinate = `${parentType.name}.${fieldDef.name}`;
            current.fields.add(coordinate);
            if (isListType(getNullableType(fieldDef.type))) current.listFields.add(coordinate);
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
          const fields = new Set<string>(byDef.get(op.id)?.fields);
          const listFields = new Set<string>(byDef.get(op.id)?.listFields);
          for (const fragmentId of fragments.reachableFragments(op.id)) {
            const metrics = byDef.get(fragmentId);
            if (!metrics) continue;
            for (const coordinate of metrics.fields) fields.add(coordinate);
            for (const coordinate of metrics.listFields) listFields.add(coordinate);
          }
          const operationDepth = effectiveDepth(op.id, new Set());
          const score =
            fields.size + operationDepth * operationDepth + listFields.size * LIST_WEIGHT;

          return {
            ref: { kind: 'operation', id: op.id },
            message: `${op.name || '(anonymous)'}: depth ${operationDepth}, ${fields.size} fields (${listFields.size} list)`,
            weight: score,
            data: {
              depth: operationDepth,
              fieldCount: fields.size,
              listFields: listFields.size,
              fields: [...fields].sort(),
              score,
            },
          };
        });

        return datapoints.sort((a, b) => b.data.score - a.data.score);
      },
    };
  },
};
