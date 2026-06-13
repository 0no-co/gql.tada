import type { ScanRule } from '../types';

export interface TypeSizeData {
  typeSize: number;
}

/** Operations whose inferred TypeScript type is largest — a proxy for type
 * inference cost. Only populated when the scan is run with `--measure-types`. */
export const typeSizeHotspots: ScanRule<TypeSizeData> = {
  name: 'type-size-hotspots',
  description: 'Operations with the largest inferred TypeScript types.',
  run(metadata) {
    return metadata.operations
      .filter((op) => op.typeSize != null)
      .sort((a, b) => (b.typeSize || 0) - (a.typeSize || 0))
      .map((op) => ({
        ref: { kind: 'operation' as const, id: op.id },
        message: `${op.name || '(anonymous)'}: inferred type is ${op.typeSize} chars`,
        data: { typeSize: op.typeSize! },
      }));
  },
};
