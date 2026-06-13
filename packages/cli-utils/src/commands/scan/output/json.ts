import type { ScanCorpus, RuleResults } from '../types';

export interface ScanJsonOutput {
  version: number;
  /** Base facts: the discovered operations, fragments, and modules. */
  corpus: ScanCorpus;
  /** Each rule's datapoints, keyed by rule name. */
  rules: RuleResults;
}

/** Serialises the analysis result — the same corpus and rule datapoints the
 * terminal report renders — to the stable JSON substrate. */
export function renderJson(corpus: ScanCorpus, rules: RuleResults): string {
  const output: ScanJsonOutput = { version: 1, corpus, rules };
  return JSON.stringify(output, null, 2) + '\n';
}
