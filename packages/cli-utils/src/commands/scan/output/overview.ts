import type { ScanContext } from '../context';
import type { RuleResults } from '../types';
import type { CoverageData } from '../rules/schema-coverage';

export interface ScanOverview {
  operations: number;
  fragments: number;
  modules: number;
  operationsByKind: { query: number; mutation: number; subscription: number };
  coverage: { usedFields: number; totalFields: number; percent: number };
}

/** Project-level totals, derived from the corpus and the schema-coverage rule.
 * Shared so the JSON `overview` and the terminal header show the same numbers. */
export function buildOverview(context: ScanContext, rules: RuleResults): ScanOverview {
  const operationsByKind = { query: 0, mutation: 0, subscription: 0 };
  for (const op of context.operations) operationsByKind[op.kind]++;

  let usedFields = 0;
  let totalFields = 0;
  for (const datapoint of rules['schema-coverage'] || []) {
    const data = datapoint.data as CoverageData;
    usedFields += data.usedFields;
    totalFields += data.totalFields;
  }
  const percent = totalFields ? Math.round((usedFields / totalFields) * 100) : 100;

  return {
    operations: context.operations.length,
    fragments: context.fragments.length,
    modules: context.modules.length,
    operationsByKind,
    coverage: { usedFields, totalFields, percent },
  };
}
