import type { ScanRule } from '../types';
import { allSchemaFields } from '../schema-util';

export interface UnusedFieldData {
  fieldType: string;
  deprecated: boolean;
}

/** Schema fields that no document selects — candidates for deprecation or removal. */
export const unusedFields: ScanRule<UnusedFieldData> = {
  name: 'unused-fields',
  description: 'Schema fields that are never selected by any document.',
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
        return allSchemaFields(context.getSchemas())
          .filter((field) => !selected.has(field.coordinate))
          .map((field) => ({
            ref: { kind: 'field', coordinate: field.coordinate },
            message: `${field.coordinate} is never selected`,
            data: {
              fieldType: field.fieldType,
              deprecated: field.deprecationReason != null,
            },
          }));
      },
    };
  },
};
