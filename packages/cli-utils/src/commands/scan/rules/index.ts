import type { ScanRule } from '../types';

import { fieldUsage } from './field-usage';
import { operationFootprint } from './operation-footprint';
import { deprecatedUsage } from './deprecated-usage';
import { schemaCoverage } from './schema-coverage';
import { orphanFragments } from './orphan-fragments';
import { couplingHotspots } from './coupling-hotspots';
import { crossFeatureFragments } from './cross-feature-fragments';
import { operationComplexity } from './operation-complexity';
import { fetchDepth } from './fetch-depth';
import { directiveUsage } from './directive-usage';

export type { FieldUsageData } from './field-usage';

/** The rules run out of the box. Each is a `(context) => { visitor, collect }`
 * factory that owns its state — adding an insight means writing one rule file
 * and registering it here. */
export const DEFAULT_RULES: ScanRule[] = [
  // The per-field usage index (reverse lookup + blast radius).
  fieldUsage,
  // The forward index: what each operation selects.
  operationFootprint,
  // Schema evolution & safety
  deprecatedUsage,
  schemaCoverage,
  // Code navigation & refactoring
  orphanFragments,
  couplingHotspots,
  crossFeatureFragments,
  // Performance & DX
  operationComplexity,
  // Code-structure (dependency graph)
  fetchDepth,
  // Conventions
  directiveUsage,
];
