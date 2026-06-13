import type { ScanRule } from '../types';
import { buildSpreadCounts } from './helpers';

/** Fragments shared by at least this many definitions count as a hotspot. */
const MIN_SPREADS = 2;

export interface CouplingData {
  spreadCount: number;
  typeCondition: string;
}

/** Fragments spread by many definitions — changing them has a wide blast radius. */
export const couplingHotspots: ScanRule<CouplingData> = {
  name: 'coupling-hotspots',
  description: 'Fragments shared across many operations/fragments.',
  run(metadata) {
    const spreadCounts = buildSpreadCounts(metadata);
    return metadata.fragments
      .map((fragment) => ({ fragment, spreadCount: spreadCounts.get(fragment.id) || 0 }))
      .filter(({ spreadCount }) => spreadCount >= MIN_SPREADS)
      .sort((a, b) => b.spreadCount - a.spreadCount)
      .map(({ fragment, spreadCount }) => ({
        ref: { kind: 'fragment' as const, id: fragment.id },
        message: `Fragment '${fragment.name}' is spread by ${spreadCount} definitions`,
        data: { spreadCount, typeCondition: fragment.typeCondition },
      }));
  },
};
