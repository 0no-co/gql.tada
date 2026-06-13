import type { ScanRule } from '../types';

export interface CoverageData {
  usedFields: number;
  totalFields: number;
  ratio: number;
}

/** Per-type schema coverage, surfacing types with unused fields (lowest first). */
export const schemaCoverage: ScanRule<CoverageData> = {
  name: 'schema-coverage',
  description: 'Per-type field coverage across the schema.',
  run(metadata) {
    return metadata.coverage.perType
      .filter((type) => type.usedFields < type.totalFields)
      .sort((a, b) => a.usedFields / a.totalFields - b.usedFields / b.totalFields)
      .map((type) => ({
        ref: { kind: 'type', name: type.typeName },
        message: `${type.typeName}: ${type.usedFields}/${type.totalFields} fields used`,
        data: {
          usedFields: type.usedFields,
          totalFields: type.totalFields,
          ratio: type.totalFields ? type.usedFields / type.totalFields : 1,
        },
      }));
  },
};
