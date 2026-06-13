import type { ScanCorpus, RuleResults, ScanGraph } from '../types';
import { buildGraph } from './graph';
import { fieldUsageMap } from './util';

export interface ScanJsonOutput {
  version: number;
  generatedFrom: {
    schemas: (string | null)[];
    modules: number;
    operations: number;
    fragments: number;
  };
  corpus: ScanCorpus;
  graph: ScanGraph;
  rules: RuleResults;
}

/** Serialises the corpus, composed graph, and rule datapoints to the stable
 * JSON substrate. */
export function renderJson(corpus: ScanCorpus, rules: RuleResults): string {
  const output: ScanJsonOutput = {
    version: 1,
    generatedFrom: {
      schemas: corpus.schemas,
      modules: corpus.modules.length,
      operations: corpus.operations.length,
      fragments: corpus.fragments.length,
    },
    corpus,
    graph: buildGraph(corpus, fieldUsageMap(rules)),
    rules,
  };
  return JSON.stringify(output, null, 2) + '\n';
}
