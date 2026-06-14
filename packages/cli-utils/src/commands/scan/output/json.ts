import type { ScanContext } from '../context';
import type { RuleResults, OperationInfo, FragmentInfo } from '../types';
import { buildOverview, type ScanOverview } from './overview';

export interface ScanJsonOutput {
  version: number;
  /** Project-level totals (same numbers the terminal header shows). */
  overview: ScanOverview;
  /** Discovered operations, with identity (kind, module, loc, variables, hash). */
  operations: OperationInfo[];
  /** Discovered fragments, with identity (type condition, module, loc, hash). */
  fragments: FragmentInfo[];
  /** Each rule's datapoints, keyed by rule name. */
  rules: RuleResults;
}

/** Serialises the analysis result — overview, operation/fragment identities, and
 * the rule datapoints the terminal report renders — to the stable JSON
 * substrate. The relationship graph is emitted separately via `--graph`. */
export function renderJson(context: ScanContext, rules: RuleResults): string {
  const output: ScanJsonOutput = {
    version: 1,
    overview: buildOverview(context, rules),
    operations: [...context.operations],
    fragments: [...context.fragments],
    rules,
  };
  return JSON.stringify(output, null, 2) + '\n';
}
