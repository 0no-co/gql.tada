import type { ScanContext } from '../context';
import type { RuleResults } from '../types';
import { allSchemaFields } from '../schema-util';

export interface ScanOverview {
  operations: number;
  fragments: number;
  modules: number;
  operationsByKind: { query: number; mutation: number; subscription: number };
  coverage: { usedFields: number; totalFields: number; percent: number };
}

/** Project-level totals, derived from the corpus, the schema, and the
 * field-usage rule. Shared so the JSON `overview` and the terminal header show
 * the same numbers. */
export function buildOverview(context: ScanContext, rules: RuleResults): ScanOverview {
  const operationsByKind = { query: 0, mutation: 0, subscription: 0 };
  for (const op of context.operations) operationsByKind[op.kind]++;

  // field-usage emits one datapoint per used schema field.
  const usedFields = (rules['field-usage'] || []).length;
  const totalFields = allSchemaFields(context.getSchemas()).length;
  const percent = totalFields ? Math.round((usedFields / totalFields) * 100) : 100;

  return {
    operations: context.operations.length,
    fragments: context.fragments.length,
    modules: context.modules.length,
    operationsByKind,
    coverage: { usedFields, totalFields, percent },
  };
}
