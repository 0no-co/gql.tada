import * as path from 'node:path';

export interface ModuleReach {
  /** The module itself plus every module that transitively depends on it. */
  modules: string[];
  /** Distinct areas covered by {@link modules}. */
  areas: string[];
  /** Entry points among {@link modules}. */
  entryPoints: string[];
}

/**
 * The project's static module dependency graph (file → its project imports).
 *
 * A self-contained, reusable structure: all reachability/area analytics live
 * here and are memoised internally, so the {@link ScanContext} exposes it as a
 * single primitive and rules can do graph analysis without the context growing.
 */
export class ModuleGraph {
  private readonly _edges: Map<string, readonly string[]>;
  private readonly _cwd: string;
  private _reverse: Map<string, Set<string>> | undefined;
  private _entryPoints: Set<string> | undefined;
  private _distance: Map<string, number> | undefined;
  private readonly _dependents = new Map<string, Set<string>>();

  constructor(edges: Map<string, string[]>, cwd: string = process.cwd()) {
    this._edges = edges;
    this._cwd = cwd;
  }

  /** The "area" a module belongs to: its directory, relative to the cwd. */
  areaOf(modulePath: string): string {
    const rel = path.relative(this._cwd, modulePath);
    const dir = path.dirname(!rel.startsWith('..') ? rel : modulePath);
    return dir === '.' ? '(root)' : dir;
  }

  /** Modules that nothing else imports — the roots of the graph. */
  entryPoints(): Set<string> {
    if (this._entryPoints) return this._entryPoints;
    const nodes = new Set<string>();
    const targets = new Set<string>();
    for (const [from, tos] of this._edges) {
      nodes.add(from);
      for (const to of tos) {
        nodes.add(to);
        targets.add(to);
      }
    }
    return (this._entryPoints = new Set([...nodes].filter((node) => !targets.has(node))));
  }

  /** Modules that transitively import the given module (its reverse closure). */
  dependents(modulePath: string): Set<string> {
    const cached = this._dependents.get(modulePath);
    if (cached) return cached;

    const reverse = this._reverseGraph();
    const result = new Set<string>();
    const stack = [...(reverse.get(modulePath) || [])];
    let node: string | undefined;
    while ((node = stack.pop())) {
      if (result.has(node)) continue;
      result.add(node);
      stack.push(...(reverse.get(node) || []));
    }

    this._dependents.set(modulePath, result);
    return result;
  }

  /** Shortest distance from any entry point to the module (entry points are 0). */
  distanceFromEntry(modulePath: string): number | undefined {
    if (!this._distance) {
      const distance = new Map<string, number>();
      let frontier = [...this.entryPoints()];
      let depth = 0;
      while (frontier.length) {
        const next: string[] = [];
        for (const node of frontier) {
          if (distance.has(node)) continue;
          distance.set(node, depth);
          for (const to of this._edges.get(node) || []) {
            if (!distance.has(to)) next.push(to);
          }
        }
        frontier = next;
        depth++;
      }
      this._distance = distance;
    }
    return this._distance.get(modulePath);
  }

  /** The blast radius of a module: itself plus everything that depends on it. */
  reach(modulePath: string): ModuleReach {
    const entryPoints = this.entryPoints();
    const modules = new Set<string>([modulePath, ...this.dependents(modulePath)]);
    const areas = new Set<string>();
    const reachedEntries = new Set<string>();
    for (const module of modules) {
      areas.add(this.areaOf(module));
      if (entryPoints.has(module)) reachedEntries.add(module);
    }
    return { modules: [...modules], areas: [...areas].sort(), entryPoints: [...reachedEntries] };
  }

  private _reverseGraph(): Map<string, Set<string>> {
    if (this._reverse) return this._reverse;
    const reverse = new Map<string, Set<string>>();
    for (const [from, tos] of this._edges) {
      for (const to of tos) {
        let importers = reverse.get(to);
        if (!importers) reverse.set(to, (importers = new Set()));
        importers.add(from);
      }
    }
    return (this._reverse = reverse);
  }
}
