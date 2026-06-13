import type { RuleResults } from '../types';
import { FIELD_USAGE_RULE, type FieldUsageData } from '../rules';

/** Reconstructs the field-usage index (keyed by coordinate) from the
 * field-usage rule's datapoints. Output renderers consume this rather than
 * reaching into rule internals. */
export function fieldUsageMap(rules: RuleResults): Map<string, FieldUsageData> {
  const map = new Map<string, FieldUsageData>();
  for (const datapoint of rules[FIELD_USAGE_RULE] || []) {
    if (datapoint.ref.kind === 'field') {
      map.set(datapoint.ref.coordinate, datapoint.data as FieldUsageData);
    }
  }
  return map;
}
