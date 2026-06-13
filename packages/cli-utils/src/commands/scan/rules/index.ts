import type { ScanRule } from '../types';

import { fieldUsage, FIELD_USAGE_RULE } from './field-usage';
import { unusedFields } from './unused-fields';
import { deprecatedUsage } from './deprecated-usage';
import { schemaCoverage } from './schema-coverage';
import { orphanFragments } from './orphan-fragments';
import { couplingHotspots } from './coupling-hotspots';
import { duplicateDocuments } from './duplicate-documents';
import { operationComplexity } from './operation-complexity';

export { FIELD_USAGE_RULE };
export type { FieldUsageData } from './field-usage';

/** The rules run out of the box. Each is a `(context) => { visitor, collect }`
 * factory that owns its state — adding an insight means writing one rule file
 * and registering it here. */
export const DEFAULT_RULES: ScanRule[] = [
  // Substrate (the field-usage index, consumed by the schema/query output).
  fieldUsage,
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
];
