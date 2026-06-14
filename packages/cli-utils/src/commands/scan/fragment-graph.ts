import type { SchemaName } from './types';

export interface FragmentGraphDefinition {
  id: string;
  kind: 'operation' | 'fragment';
  schemaName: SchemaName;
  /** The fragment's name (present for fragment definitions). */
  name?: string;
  /** Names of fragments spread directly by this definition. */
  fragmentSpreads: readonly string[];
}

const key = (schemaName: SchemaName, name: string): string => `${schemaName ?? ''}\0${name}`;

/**
 * The fragment spread graph: resolution by name and reachability between
 * definitions.
 *
 * A self-contained, reusable structure (the GraphQL-side analogue of
 * {@link ModuleGraph}). Reachability is memoised internally, so the
 * {@link ScanContext} exposes it as a single primitive and rules can do
 * fragment-graph analysis without the context growing per rule.
 */
export class FragmentGraph {
  private readonly _byId = new Map<string, FragmentGraphDefinition>();
  private readonly _idByName = new Map<string, string>();
  private readonly _operationIds: string[] = [];
  private readonly _reachable = new Map<string, Set<string>>();
  private _operationsReaching: Map<string, Set<string>> | undefined;

  constructor(definitions: readonly FragmentGraphDefinition[]) {
    for (const definition of definitions) {
      this._byId.set(definition.id, definition);
      if (definition.kind === 'operation') {
        this._operationIds.push(definition.id);
      } else if (definition.name != null) {
        this._idByName.set(key(definition.schemaName, definition.name), definition.id);
      }
    }
  }

  /** Resolves a fragment name to its id within a schema. */
  resolve(schemaName: SchemaName, name: string): string | undefined {
    return this._idByName.get(key(schemaName, name));
  }

  /** Ids of fragments reachable from a definition via (nested) spreads. */
  reachableFragments(definitionId: string): Set<string> {
    const cached = this._reachable.get(definitionId);
    if (cached) return cached;

    const result = new Set<string>();
    const start = this._byId.get(definitionId);
    if (start) {
      const stack = [...start.fragmentSpreads];
      let name: string | undefined;
      while ((name = stack.pop())) {
        const id = this.resolve(start.schemaName, name);
        if (!id || result.has(id)) continue;
        result.add(id);
        const fragment = this._byId.get(id);
        if (fragment) stack.push(...fragment.fragmentSpreads);
      }
    }

    this._reachable.set(definitionId, result);
    return result;
  }

  /** Operation ids that reach a fragment directly or transitively. */
  operationsReaching(fragmentId: string): Set<string> {
    if (!this._operationsReaching) {
      const map = new Map<string, Set<string>>();
      for (const operationId of this._operationIds) {
        for (const reachableId of this.reachableFragments(operationId)) {
          let set = map.get(reachableId);
          if (!set) map.set(reachableId, (set = new Set()));
          set.add(operationId);
        }
      }
      this._operationsReaching = map;
    }
    return this._operationsReaching.get(fragmentId) || new Set();
  }
}
