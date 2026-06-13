import type { ScanRule } from '../types';

export interface FetchDepthData {
  /** Shortest import-distance from an entry point to the defining module. */
  depth: number | null;
  area: string;
  module: string;
}

/** Where each query sits in the module graph: how far its defining module is
 * from an entry point. As a distribution this describes data-fetching placement
 * (hoisted to route boundaries vs. scattered deep in the tree, i.e. waterfalls).
 *
 * Restricted to queries: mutations and subscriptions are naturally triggered
 * deep in the tree (event handlers, forms), so their depth carries no signal. */
export const fetchDepth: ScanRule<FetchDepthData> = {
  name: 'fetch-depth',
  description: 'Distance from an entry point to where each query is defined.',
  create(context) {
    // Reads the static module graph in collect(); no traversal state needed.
    return {
      visitor: {},
      collect() {
        return context.operations
          .filter((op) => op.kind === 'query')
          .map((op) => {
            const depth = context.getDistanceFromEntry(op.module);
            return { op, depth: depth ?? null };
          })
          .sort((a, b) => (b.depth ?? -1) - (a.depth ?? -1))
          .map(({ op, depth }) => ({
            ref: { kind: 'operation' as const, id: op.id },
            message: `${op.name || '(anonymous)'} is ${
              depth == null
                ? 'unreachable from any entry point'
                : `${depth} hop(s) from an entry point`
            }`,
            weight: depth ?? undefined,
            data: { depth, area: context.areaOf(op.module), module: op.module },
          }));
      },
    };
  },
};
