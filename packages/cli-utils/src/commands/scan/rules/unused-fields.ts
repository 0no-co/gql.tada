import type { ScanRule } from '../types';

export interface UnusedFieldData {
  fieldType: string;
  deprecated: boolean;
}

/** Schema fields that no document selects — candidates for deprecation or removal. */
export const unusedFields: ScanRule<UnusedFieldData> = {
  name: 'unused-fields',
  description: 'Schema fields that are never selected by any document.',
  run(metadata) {
    return Object.values(metadata.fieldIndex)
      .filter((entry) => entry.count === 0)
      .sort((a, b) => a.coordinate.localeCompare(b.coordinate))
      .map((entry) => ({
        ref: { kind: 'field', coordinate: entry.coordinate },
        message: `${entry.coordinate} is never selected`,
        data: { fieldType: entry.fieldType, deprecated: entry.deprecated },
      }));
  },
};
