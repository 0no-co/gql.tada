import type { ScanMetadata, ScanRule, RuleResults } from '../types';

import { unusedFields } from './unused-fields';
import { deprecatedUsage } from './deprecated-usage';
import { schemaCoverage } from './schema-coverage';
import { orphanFragments } from './orphan-fragments';
import { couplingHotspots } from './coupling-hotspots';
import { duplicateDocuments } from './duplicate-documents';
import { operationComplexity } from './operation-complexity';
import { typeSizeHotspots } from './type-size-hotspots';

/** The insights produced out of the box. Adding an insight means writing one
 * rule file and registering it here — no metadata or output changes needed. */
export const DEFAULT_RULES: ScanRule[] = [
  // Schema evolution & safety
  unusedFields,
  deprecatedUsage,
  schemaCoverage,
  // Code navigation & refactoring
  orphanFragments,
  couplingHotspots,
  duplicateDocuments,
  // Performance & DX
  operationComplexity,
  typeSizeHotspots,
];

/** Runs every rule over the metadata and collects their datapoints by name. */
export function runRules(metadata: ScanMetadata, rules: ScanRule[] = DEFAULT_RULES): RuleResults {
  const results: RuleResults = {};
  for (const rule of rules) results[rule.name] = rule.run(metadata);
  return results;
}
