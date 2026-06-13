import type { ScanRule, RuleDatapoint } from '../types';

export interface DuplicateData {
  hash: string;
  members: { id: string; module: string; line: number }[];
}

interface OperationRef {
  id: string;
  name: string | null;
  module: string;
  line: number;
  hash: string;
  schemaName: string | null;
}

/** Operations whose normalised document is identical to another operation —
 * candidates for consolidation. */
export const duplicateDocuments: ScanRule<DuplicateData> = {
  name: 'duplicate-documents',
  description: 'Operations duplicated across modules.',
  create(context) {
    const operations: OperationRef[] = [];

    return {
      visitor: {
        OperationDefinition: {
          enter() {
            const definition = context.getCurrentDefinition();
            if (definition && definition.defKind === 'operation') {
              operations.push({
                id: definition.id,
                name: definition.name,
                module: definition.module,
                line: definition.loc.line,
                hash: definition.hash,
                schemaName: definition.schemaName,
              });
            }
          },
        },
      },

      collect() {
        const groups = new Map<string, OperationRef[]>();
        for (const op of operations) {
          const key = `${op.schemaName ?? ''}\0${op.hash}`;
          const group = groups.get(key);
          if (group) group.push(op);
          else groups.set(key, [op]);
        }

        const datapoints: RuleDatapoint<DuplicateData>[] = [];
        for (const group of groups.values()) {
          if (group.length < 2) continue;
          const [first] = group;
          datapoints.push({
            ref: { kind: 'operation', id: first.id },
            message: `${group.length} identical copies of ${first.name ? `'${first.name}'` : 'an anonymous operation'}`,
            data: {
              hash: first.hash,
              members: group.map((op) => ({ id: op.id, module: op.module, line: op.line })),
            },
          });
        }
        return datapoints;
      },
    };
  },
};
