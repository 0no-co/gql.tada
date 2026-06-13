import type { ScanContext } from '../context';
import type { RuleResults, ScanGraph } from '../types';
import { buildOverview, type ScanOverview } from './overview';
import { buildGraph } from './graph';

export interface ScanJsonOutput {
  version: number;
  /** Project-level totals (same numbers the terminal header shows). */
  overview: ScanOverview;
  /** The module ↔ document ↔ fragment ↔ schema relationship graph. */
  graph: ScanGraph;
  /** Each rule's datapoints, keyed by rule name. */
  rules: RuleResults;
}

/** Serialises the analysis result — overview, relationship graph, and the rule
 * datapoints the terminal report renders — to the stable JSON substrate. */
export function renderJson(context: ScanContext, rules: RuleResults): string {
  const output: ScanJsonOutput = {
    version: 1,
    overview: buildOverview(context, rules),
    graph: buildGraph(context, rules),
    rules,
  };
  return JSON.stringify(output, null, 2) + '\n';
}
