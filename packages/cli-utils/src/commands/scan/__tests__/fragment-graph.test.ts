import { describe, it, expect } from 'vitest';

import { FragmentGraph } from '../fragment-graph';

// Q -> A -> B (nested fragment spreads)
const graph = new FragmentGraph([
  { id: 'op:Q', kind: 'operation', schemaName: null, fragmentSpreads: ['A'] },
  { id: 'frag:A', kind: 'fragment', schemaName: null, name: 'A', fragmentSpreads: ['B'] },
  { id: 'frag:B', kind: 'fragment', schemaName: null, name: 'B', fragmentSpreads: [] },
  { id: 'frag:Orphan', kind: 'fragment', schemaName: null, name: 'Orphan', fragmentSpreads: [] },
]);

describe('FragmentGraph', () => {
  it('is a standalone structure built from definitions (no context needed)', () => {
    expect(graph.resolve(null, 'A')).toBe('frag:A');
    expect(graph.resolve(null, 'Missing')).toBeUndefined();
  });

  it('resolves fragments reachable through nesting', () => {
    expect([...graph.reachableFragments('op:Q')].sort()).toEqual(['frag:A', 'frag:B']);
  });

  it('maps fragments back to the operations that reach them', () => {
    expect([...graph.operationsReaching('frag:B')]).toEqual(['op:Q']);
    expect([...graph.operationsReaching('frag:Orphan')]).toEqual([]);
  });

  it('scopes resolution by schema name', () => {
    const multi = new FragmentGraph([
      { id: 'a:Frag', kind: 'fragment', schemaName: 'a', name: 'Frag', fragmentSpreads: [] },
      { id: 'b:Frag', kind: 'fragment', schemaName: 'b', name: 'Frag', fragmentSpreads: [] },
    ]);
    expect(multi.resolve('a', 'Frag')).toBe('a:Frag');
    expect(multi.resolve('b', 'Frag')).toBe('b:Frag');
  });
});
