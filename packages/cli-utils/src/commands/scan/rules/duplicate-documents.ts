import type { ScanRule, OperationInfo } from '../types';

export interface DuplicateData {
  hash: string;
  members: { id: string; module: string; line: number }[];
}

/** Operations whose normalised document is identical to another operation —
 * candidates for consolidation. */
export const duplicateDocuments: ScanRule<DuplicateData> = {
  name: 'duplicate-documents',
  description: 'Operations duplicated across modules.',
  run(metadata) {
    const groups = new Map<string, OperationInfo[]>();
    for (const op of metadata.operations) {
      const key = `${op.schemaName ?? ''}\0${op.hash}`;
      const group = groups.get(key);
      if (group) group.push(op);
      else groups.set(key, [op]);
    }

    const datapoints = [];
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const [first] = group;
      datapoints.push({
        ref: { kind: 'operation' as const, id: first.id },
        message: `${group.length} identical copies of ${first.name ? `'${first.name}'` : 'an anonymous operation'}`,
        data: {
          hash: first.hash,
          members: group.map((op) => ({ id: op.id, module: op.module, line: op.loc.line })),
        },
      });
    }
    return datapoints;
  },
};
