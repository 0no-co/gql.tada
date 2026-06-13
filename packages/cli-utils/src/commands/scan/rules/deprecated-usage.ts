import type { ScanRule } from '../types';

export interface DeprecatedUsageData {
  reason?: string | undefined;
  count: number;
  operations: string[];
}

/** Deprecated schema fields that are still selected, ranked by how many
 * operations reach them — i.e. the migration's remaining blast radius. */
export const deprecatedUsage: ScanRule<DeprecatedUsageData> = {
  name: 'deprecated-usage',
  description: 'Deprecated schema fields that are still in use.',
  run(metadata) {
    return Object.values(metadata.fieldIndex)
      .filter((entry) => entry.deprecated && entry.count > 0)
      .sort((a, b) => b.operations.length - a.operations.length)
      .map((entry) => ({
        ref: { kind: 'field', coordinate: entry.coordinate },
        message: `${entry.coordinate} is deprecated but used by ${entry.operations.length} operation(s)`,
        data: {
          reason: entry.deprecationReason,
          count: entry.count,
          operations: entry.operations,
        },
      }));
  },
};
