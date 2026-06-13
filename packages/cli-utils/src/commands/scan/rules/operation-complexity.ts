import type { ScanRule, RuleDatapoint } from '../types';

export interface ComplexityData {
  depth: number;
  fieldCount: number;
  /** Structural score from depth and field count. */
  score: number;
  /** Size of the inferred TypeScript type (type-level cost). */
  typeSize?: number | undefined;
}

/** Structural complexity score from depth and field count. */
const scoreOf = (depth: number, fieldCount: number): number => fieldCount + depth * depth;

interface Result {
  id: string;
  name: string | null;
  depth: number;
  fieldCount: number;
  typeSize?: number | undefined;
}

/** Operations ranked by cost: GraphQL selection depth and field count, plus the
 * inferred TypeScript type size (always measured). Ranks by type size when known
 * — the truest proxy for both server and type-inference cost — otherwise by the
 * structural score. */
export const operationComplexity: ScanRule<ComplexityData> = {
  name: 'operation-complexity',
  description: 'Operations ranked by selection complexity and inferred type size.',
  create(context) {
    const results: Result[] = [];
    const typeSizeById = new Map<string, number | undefined>();
    for (const op of context.operations) typeSizeById.set(op.id, op.typeSize);

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
            if (current) {
              results.push({
                ...current,
                depth: maxDepth,
                fieldCount,
                typeSize: typeSizeById.get(current.id),
              });
            }
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
          .sort((a, b) => {
            // Prefer the type-level cost when both are measured.
            if (a.result.typeSize != null && b.result.typeSize != null) {
              return b.result.typeSize - a.result.typeSize;
            }
            return b.score - a.score;
          })
          .map(({ result, score }) => {
            const typeSuffix = result.typeSize != null ? `, type ${result.typeSize} chars` : '';
            return {
              ref: { kind: 'operation', id: result.id },
              message: `${result.name || '(anonymous)'}: depth ${result.depth}, ${result.fieldCount} fields${typeSuffix}`,
              data: {
                depth: result.depth,
                fieldCount: result.fieldCount,
                score,
                typeSize: result.typeSize,
              },
            };
          });
        return datapoints;
      },
    };
  },
};
