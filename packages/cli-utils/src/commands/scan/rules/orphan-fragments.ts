import type { ScanRule } from '../types';
import { buildSpreadCounts } from './helpers';

export interface OrphanFragmentData {
  typeCondition: string;
  module: string;
}

/** Fragments that are defined but never spread by any operation or fragment. */
export const orphanFragments: ScanRule<OrphanFragmentData> = {
  name: 'orphan-fragments',
  description: 'Fragments that are defined but never used.',
  run(metadata) {
    const spreadCounts = buildSpreadCounts(metadata);
    return metadata.fragments
      .filter((fragment) => !spreadCounts.get(fragment.id))
      .map((fragment) => ({
        ref: {
          kind: 'fragment' as const,
          id: fragment.id,
        },
        message: `Fragment '${fragment.name}' is never spread`,
        data: { typeCondition: fragment.typeCondition, module: fragment.module },
      }));
  },
};
