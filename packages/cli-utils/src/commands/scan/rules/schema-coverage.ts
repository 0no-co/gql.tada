import type { ScanRule } from '../types';
import { allSchemaFields } from '../schema-util';

export interface CoverageData {
  usedFields: number;
  totalFields: number;
  ratio: number;
}

/** Per-type schema coverage. Emits a datapoint for every type (lowest coverage
 * first) so consumers can both list offenders and derive an overall figure. */
export const schemaCoverage: ScanRule<CoverageData> = {
  name: 'schema-coverage',
  description: 'Per-type field coverage across the schema.',
  create(context) {
    const selected = new Set<string>();

    return {
      visitor: {
        Field: {
          enter() {
            const parentType = context.getParentType();
            const fieldDef = context.getFieldDef();
            if (parentType && fieldDef) selected.add(`${parentType.name}.${fieldDef.name}`);
          },
        },
      },

      collect() {
        const byType = new Map<string, { used: number; total: number }>();
        for (const field of allSchemaFields(context.getSchemas())) {
          let counts = byType.get(field.typeName);
          if (!counts) byType.set(field.typeName, (counts = { used: 0, total: 0 }));
          counts.total++;
          if (selected.has(field.coordinate)) counts.used++;
        }

        return [...byType.entries()]
          .sort((a, b) => a[1].used / a[1].total - b[1].used / b[1].total)
          .map(([typeName, counts]) => ({
            ref: { kind: 'type', name: typeName },
            message: `${typeName}: ${counts.used}/${counts.total} fields used`,
            data: {
              usedFields: counts.used,
              totalFields: counts.total,
              ratio: counts.total ? counts.used / counts.total : 1,
            },
          }));
      },
    };
  },
};
