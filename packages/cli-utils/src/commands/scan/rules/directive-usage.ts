import type { ScanRule } from '../types';

export interface DirectiveUsageData {
  count: number;
}

/** How often each directive is applied across all documents (e.g. `@skip`,
 * `@include`, `@defer`, `@_unmask`, custom client directives). Useful for
 * gauging adoption of directive-based features. */
export const directiveUsage: ScanRule<DirectiveUsageData> = {
  name: 'directive-usage',
  description: 'Application count per directive across documents.',
  create() {
    const counts = new Map<string, number>();
    return {
      visitor: {
        Directive: {
          enter(node) {
            counts.set(node.name.value, (counts.get(node.name.value) || 0) + 1);
          },
        },
      },
      collect() {
        return [...counts.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([name, count]) => ({
            ref: { kind: 'directive', name },
            message: `@${name} applied ${count} time(s)`,
            weight: count,
            data: { count },
          }));
      },
    };
  },
};
