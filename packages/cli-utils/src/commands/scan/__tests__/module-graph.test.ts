import { describe, it, expect } from 'vitest';

import { ModuleGraph } from '../module-graph';

// app -> a, b ; a -> shared ; b -> shared
const graph = new ModuleGraph(
  new Map([
    ['/p/app.ts', ['/p/feature-a/list.ts', '/p/feature-b/card.ts']],
    ['/p/feature-a/list.ts', ['/p/shared/frag.ts']],
    ['/p/feature-b/card.ts', ['/p/shared/frag.ts']],
    ['/p/shared/frag.ts', []],
  ]),
  '/p'
);

describe('ModuleGraph', () => {
  it('is a standalone structure built from edges (no context needed)', () => {
    expect([...graph.entryPoints()]).toEqual(['/p/app.ts']);
  });

  it('computes transitive dependents and distance', () => {
    expect([...graph.dependents('/p/shared/frag.ts')].sort()).toEqual([
      '/p/app.ts',
      '/p/feature-a/list.ts',
      '/p/feature-b/card.ts',
    ]);
    expect(graph.distanceFromEntry('/p/shared/frag.ts')).toBe(2);
  });

  it('derives areas relative to its cwd', () => {
    expect(graph.areaOf('/p/feature-a/list.ts')).toBe('feature-a');
  });

  it('reports the blast radius of a module', () => {
    const reach = graph.reach('/p/shared/frag.ts');
    expect(reach.entryPoints).toEqual(['/p/app.ts']);
    expect(reach.areas.sort()).toEqual(['(root)', 'feature-a', 'feature-b', 'shared']);
  });
});
