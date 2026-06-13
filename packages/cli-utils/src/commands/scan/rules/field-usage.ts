import type { ScanRule, RuleDatapoint } from '../types';
import { allSchemaFields } from '../schema-util';

/** Name of the field-usage rule, used by output renderers to read its index. */
export const FIELD_USAGE_RULE = 'field-usage';

export interface FieldUsageData {
  typeName: string;
  fieldName: string;
  fieldType: string;
  deprecated: boolean;
  deprecationReason?: string | undefined;
  count: number;
  directUsages: { defId: string; module: string }[];
  /** Operation ids that reach this field directly or transitively. */
  operations: string[];
}

interface Accumulated {
  typeName: string;
  fieldName: string;
  fieldType?: string;
  deprecationReason?: string;
  directUsages: { defId: string; module: string }[];
}

/** Builds the per-field usage index: which operations/fragments select each
 * schema coordinate. This is the substrate the annotated schema and the
 * `--field`/`--module` queries are rendered from. */
export const fieldUsage: ScanRule<FieldUsageData> = {
  name: 'field-usage',
  description: 'Per-field usage index keyed by schema coordinate.',
  create(context) {
    const byCoordinate = new Map<string, Accumulated>();
    let seen = new Set<string>();

    const resetSeen = () => void (seen = new Set());

    return {
      visitor: {
        OperationDefinition: { enter: resetSeen },
        FragmentDefinition: { enter: resetSeen },
        Field: {
          enter() {
            const parentType = context.getParentType();
            const fieldDef = context.getFieldDef();
            const definition = context.getCurrentDefinition();
            if (!parentType || !fieldDef || !definition) return;

            const coordinate = `${parentType.name}.${fieldDef.name}`;
            if (seen.has(coordinate)) return;
            seen.add(coordinate);

            let entry = byCoordinate.get(coordinate);
            if (!entry) {
              entry = {
                typeName: parentType.name,
                fieldName: fieldDef.name,
                fieldType: String(fieldDef.type),
                deprecationReason: fieldDef.deprecationReason ?? undefined,
                directUsages: [],
              };
              byCoordinate.set(coordinate, entry);
            }
            entry.directUsages.push({ defId: definition.id, module: definition.module });
          },
        },
      },

      collect() {
        // Reconcile against the schema so unused fields (count 0) appear too.
        for (const field of allSchemaFields(context.getSchemas())) {
          if (!byCoordinate.has(field.coordinate)) {
            byCoordinate.set(field.coordinate, {
              typeName: field.typeName,
              fieldName: field.fieldName,
              fieldType: field.fieldType,
              deprecationReason: field.deprecationReason,
              directUsages: [],
            });
          }
        }

        const operationIds = new Set(context.operations.map((op) => op.id));
        const datapoints: RuleDatapoint<FieldUsageData>[] = [];
        for (const [coordinate, entry] of byCoordinate) {
          const operations = new Set<string>();
          for (const usage of entry.directUsages) {
            if (operationIds.has(usage.defId)) {
              operations.add(usage.defId);
            } else {
              for (const id of context.getOperationsReachingFragment(usage.defId)) {
                operations.add(id);
              }
            }
          }

          datapoints.push({
            ref: { kind: 'field', coordinate },
            message: `${coordinate} selected ${entry.directUsages.length} time(s)`,
            data: {
              typeName: entry.typeName,
              fieldName: entry.fieldName,
              fieldType: entry.fieldType || '',
              deprecated: entry.deprecationReason != null,
              deprecationReason: entry.deprecationReason,
              count: entry.directUsages.length,
              directUsages: entry.directUsages,
              operations: [...operations],
            },
          });
        }
        return datapoints.sort((a, b) =>
          (a.ref as { coordinate: string }).coordinate.localeCompare(
            (b.ref as { coordinate: string }).coordinate
          )
        );
      },
    };
  },
};
