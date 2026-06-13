import type { ScanMetadata, RuleResults } from '../types';

export interface ScanJsonOutput {
  version: number;
  generatedFrom: {
    schemas: (string | null)[];
    modules: number;
    operations: number;
    fragments: number;
  };
  metadata: ScanMetadata;
  rules: RuleResults;
}

/** Serialises the metadata layer and rule datapoints to the stable JSON substrate. */
export function renderJson(metadata: ScanMetadata, rules: RuleResults): string {
  const output: ScanJsonOutput = {
    version: 1,
    generatedFrom: {
      schemas: metadata.schemas,
      modules: metadata.modules.length,
      operations: metadata.operations.length,
      fragments: metadata.fragments.length,
    },
    metadata,
    rules,
  };
  return JSON.stringify(output, null, 2) + '\n';
}
