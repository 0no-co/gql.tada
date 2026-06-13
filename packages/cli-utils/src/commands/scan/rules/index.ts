import type { ScanRule } from '../types';

import { fieldUsage } from './field-usage';
import { unusedFields } from './unused-fields';
import { deprecatedUsage } from './deprecated-usage';
import { schemaCoverage } from './schema-coverage';
import { orphanFragments } from './orphan-fragments';
import { couplingHotspots } from './coupling-hotspots';
import { crossFeatureFragments } from './cross-feature-fragments';
import { duplicateDocuments } from './duplicate-documents';
import { operationComplexity } from './operation-complexity';
import { fetchDepth } from './fetch-depth';

export type { FieldUsageData } from './field-usage';

/** The rules run out of the box. Each is a `(context) => { visitor, collect }`
 * factory that owns its state — adding an insight means writing one rule file
 * and registering it here. */
export const DEFAULT_RULES: ScanRule[] = [
  // The per-field usage index (reverse lookup + blast radius).
  fieldUsage,
  // Schema evolution & safety
  unusedFields,
  deprecatedUsage,
  schemaCoverage,
  // Code navigation & refactoring
  orphanFragments,
  couplingHotspots,
  crossFeatureFragments,
  duplicateDocuments,
  // Performance & DX
  operationComplexity,
  // Code-structure (dependency graph)
  fetchDepth,
];
