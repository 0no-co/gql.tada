import type { ScanRule } from '../types';

export interface ComplexityData {
  depth: number;
  fieldCount: number;
  score: number;
}

/** Combined complexity score for an operation. */
const scoreOf = (depth: number, fieldCount: number): number => fieldCount + depth * depth;

/** Operations ranked by selection depth and field count — a proxy for server
 * cost and N+1 risk. */
export const operationComplexity: ScanRule<ComplexityData> = {
  name: 'operation-complexity',
  description: 'Operations ranked by depth and field count.',
  run(metadata) {
    return metadata.operations
      .map((op) => ({ op, score: scoreOf(op.depth, op.fieldCount) }))
      .sort((a, b) => b.score - a.score)
      .map(({ op, score }) => ({
        ref: { kind: 'operation' as const, id: op.id },
        message: `${op.name || '(anonymous)'}: depth ${op.depth}, ${op.fieldCount} fields`,
        data: { depth: op.depth, fieldCount: op.fieldCount, score },
      }));
  },
};
