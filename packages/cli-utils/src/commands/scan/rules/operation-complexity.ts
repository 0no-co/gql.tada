import type { ScanRule, RuleDatapoint } from '../types';

export interface ComplexityData {
  depth: number;
  fieldCount: number;
  score: number;
}

/** Combined complexity score for an operation. */
const scoreOf = (depth: number, fieldCount: number): number => fieldCount + depth * depth;

interface Result {
  id: string;
  name: string | null;
  depth: number;
  fieldCount: number;
}

/** Operations ranked by selection depth and field count — a proxy for server
 * cost and N+1 risk. The rule computes depth/field counts itself as it walks. */
export const operationComplexity: ScanRule<ComplexityData> = {
  name: 'operation-complexity',
  description: 'Operations ranked by depth and field count.',
  create(context) {
    const results: Result[] = [];
    let current: { id: string; name: string | null } | null = null;
    let depth = 0;
    let maxDepth = 0;
    let fieldCount = 0;

    return {
      visitor: {
        OperationDefinition: {
          enter() {
            const definition = context.getCurrentDefinition();
            current =
              definition && definition.defKind === 'operation'
                ? { id: definition.id, name: definition.name }
                : null;
            depth = 0;
            maxDepth = 0;
            fieldCount = 0;
          },
          leave() {
            if (current) results.push({ ...current, depth: maxDepth, fieldCount });
            current = null;
          },
        },
        SelectionSet: {
          enter() {
            if (current && ++depth > maxDepth) maxDepth = depth;
          },
          leave() {
            if (current) depth--;
          },
        },
        Field: {
          enter() {
            if (current) fieldCount++;
          },
        },
      },

      collect() {
        const datapoints: RuleDatapoint<ComplexityData>[] = results
          .map((result) => ({ result, score: scoreOf(result.depth, result.fieldCount) }))
          .sort((a, b) => b.score - a.score)
          .map(({ result, score }) => ({
            ref: { kind: 'operation', id: result.id },
            message: `${result.name || '(anonymous)'}: depth ${result.depth}, ${result.fieldCount} fields`,
            data: { depth: result.depth, fieldCount: result.fieldCount, score },
          }));
        return datapoints;
      },
    };
  },
};
