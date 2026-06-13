import type { ScanMetadata, SchemaName } from '../types';

const spreadKey = (schemaName: SchemaName, name: string): string => `${schemaName ?? ''}\0${name}`;

/** Counts how many operations/fragments directly spread each fragment, keyed by
 * fragment id. Resolves spread names within the same schema. */
export function buildSpreadCounts(metadata: ScanMetadata): Map<string, number> {
  const idByName = new Map<string, string>();
  for (const fragment of metadata.fragments) {
    idByName.set(spreadKey(fragment.schemaName, fragment.name), fragment.id);
  }

  const counts = new Map<string, number>();
  const tally = (schemaName: SchemaName, spreads: readonly string[]): void => {
    for (const name of spreads) {
      const id = idByName.get(spreadKey(schemaName, name));
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    }
  };

  for (const op of metadata.operations) tally(op.schemaName, op.fragmentSpreads);
  for (const fragment of metadata.fragments) tally(fragment.schemaName, fragment.fragmentSpreads);

  return counts;
}
