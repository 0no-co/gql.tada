import type { ScanContext } from '../context';
import type { RuleResults } from '../types';
import { buildOverview, type ScanOverview } from './overview';

export interface ScanJsonOutput {
  version: number;
  /** Project-level totals (same numbers the terminal header shows). */
  overview: ScanOverview;
  /** Each rule's datapoints, keyed by rule name. */
  rules: RuleResults;
}

/** Serialises the analysis result — overview plus the rule datapoints the
 * terminal report renders — to the stable JSON substrate. The relationship
 * graph is emitted separately via `--graph`. */
export function renderJson(context: ScanContext, rules: RuleResults): string {
  const output: ScanJsonOutput = { version: 1, overview: buildOverview(context, rules), rules };
  return JSON.stringify(output, null, 2) + '\n';
}
