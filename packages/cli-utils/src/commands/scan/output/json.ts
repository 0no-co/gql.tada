import type { RuleResults } from '../types';

export interface ScanJsonOutput {
  version: number;
  /** Each rule's datapoints, keyed by rule name. */
  rules: RuleResults;
}

/** Serialises the rule datapoints — the same insights the terminal report
 * renders — to the stable JSON substrate. */
export function renderJson(rules: RuleResults): string {
  const output: ScanJsonOutput = { version: 1, rules };
  return JSON.stringify(output, null, 2) + '\n';
}
