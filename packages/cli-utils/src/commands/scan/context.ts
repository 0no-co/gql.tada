import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { parse, print, visit, Kind } from 'graphql';
import type {
  GraphQLSchema,
  GraphQLCompositeType,
  GraphQLField,
  GraphQLOutputType,
  TypeInfo,
  ASTNode,
  ASTVisitor,
  DefinitionNode,
  OperationDefinitionNode,
  FragmentDefinitionNode,
} from 'graphql';

import type {
  SchemaName,
  RawScanDocument,
  ScanWarning,
  ModuleInfo,
  OperationInfo,
  FragmentInfo,
  DefinitionRecord,
  ScanCorpus,
} from './types';

const CWD = process.cwd();

export interface ScanContextParams {
  documents: RawScanDocument[];
  schemas: Map<SchemaName, GraphQLSchema>;
  imports: Map<string, string[]>;
  warnings: ScanWarning[];
}

const hashOf = (input: string): string =>
  crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);

const fragmentKey = (schemaName: SchemaName, name: string): string =>
  `${schemaName ?? ''}\0${name}`;

/** Collects the names of fragments spread anywhere within a definition. */
function collectFragmentSpreads(node: DefinitionNode): string[] {
  const names = new Set<string>();
  visit(node, {
    FragmentSpread(spread) {
      names.add(spread.name.value);
    },
  });
  return [...names];
}

/**
 * Shared state passed to every scan rule, modelled on graphql-js's
 * `ValidationContext`.
 *
 * It exposes only *primitives*: the loaded schemas, the corpus of discovered
 * definitions (identities + AST nodes), fragment resolution, structural
 * reachability helpers, and TypeInfo-backed accessors for the current
 * traversal position. It never holds derived insight data — rules build that
 * themselves.
 */
export class ScanContext {
  private readonly _schemas: Map<SchemaName, GraphQLSchema>;
  private readonly _warnings: ScanWarning[];
  private readonly _operations: OperationInfo[] = [];
  private readonly _fragments: FragmentInfo[] = [];
  private readonly _definitions: DefinitionRecord[] = [];
  private readonly _recordByNode = new Map<ASTNode, DefinitionRecord>();
  private readonly _fragmentIdByName = new Map<string, string>();
  private readonly _recordById = new Map<string, DefinitionRecord>();
  private readonly _modules: ModuleInfo[];

  private readonly _reachableFragments = new Map<string, Set<string>>();
  private _operationsReachingFragment: Map<string, Set<string>> | undefined;

  private _typeInfo: TypeInfo | null = null;
  private _currentDefinition: DefinitionRecord | null = null;

  // Static module dependency graph (every scanned file → its project imports).
  private readonly _importGraph: Map<string, string[]>;
  private _reverseGraph: Map<string, Set<string>> | undefined;
  private _entryPoints: Set<string> | undefined;
  private _distanceFromEntry: Map<string, number> | undefined;
  private readonly _dependents = new Map<string, Set<string>>();

  constructor(params: ScanContextParams) {
    this._schemas = params.schemas;
    this._warnings = [...params.warnings];
    this._importGraph = params.imports;
    this._buildCorpus(params.documents);
    this._modules = this._buildModules(params.imports);
  }

  /* -- Corpus accessors (base facts) -- */

  get schemaNames(): SchemaName[] {
    return [...this._schemas.keys()];
  }

  get operations(): readonly OperationInfo[] {
    return this._operations;
  }

  get fragments(): readonly FragmentInfo[] {
    return this._fragments;
  }

  get modules(): readonly ModuleInfo[] {
    return this._modules;
  }

  get warnings(): readonly ScanWarning[] {
    return this._warnings;
  }

  getSchemas(): Map<SchemaName, GraphQLSchema> {
    return this._schemas;
  }

  /** Definition AST nodes for a single schema, for per-schema traversal. */
  definitionNodesForSchema(schemaName: SchemaName): DefinitionNode[] {
    const nodes: DefinitionNode[] = [];
    for (const record of this._definitions) {
      if (record.schemaName === schemaName) nodes.push(record.node);
    }
    return nodes;
  }

  toCorpus(): ScanCorpus {
    return {
      schemas: this.schemaNames,
      modules: this._modules,
      operations: this._operations,
      fragments: this._fragments,
      warnings: this._warnings,
    };
  }

  /* -- Traversal primitives (set by the driver) -- */

  /** @internal Used by the driver to bind the active schema's TypeInfo. */
  setTypeInfo(typeInfo: TypeInfo): void {
    this._typeInfo = typeInfo;
  }

  /** A visitor the driver runs first so rules can read the current definition. */
  trackingVisitor(): ASTVisitor {
    return {
      OperationDefinition: {
        enter: (node) => void (this._currentDefinition = this._recordByNode.get(node) || null),
        leave: () => void (this._currentDefinition = null),
      },
      FragmentDefinition: {
        enter: (node) => void (this._currentDefinition = this._recordByNode.get(node) || null),
        leave: () => void (this._currentDefinition = null),
      },
    };
  }

  getCurrentDefinition(): DefinitionRecord | null {
    return this._currentDefinition;
  }

  getParentType(): GraphQLCompositeType | null | undefined {
    return this._typeInfo?.getParentType();
  }

  getType(): GraphQLOutputType | null | undefined {
    return this._typeInfo?.getType();
  }

  getFieldDef(): GraphQLField<unknown, unknown> | null | undefined {
    return this._typeInfo?.getFieldDef();
  }

  /* -- Structural helpers -- */

  getDefinition(id: string): DefinitionRecord | undefined {
    return this._recordById.get(id);
  }

  getFragment(schemaName: SchemaName, name: string): DefinitionRecord | undefined {
    const id = this._fragmentIdByName.get(fragmentKey(schemaName, name));
    return id ? this._recordById.get(id) : undefined;
  }

  /** Ids of fragments reachable from a definition via (nested) spreads. */
  getRecursivelyReferencedFragments(definition: DefinitionRecord): Set<string> {
    const cached = this._reachableFragments.get(definition.id);
    if (cached) return cached;

    const result = new Set<string>();
    const stack = [...definition.fragmentSpreads];
    let name: string | undefined;
    while ((name = stack.pop())) {
      const fragment = this.getFragment(definition.schemaName, name);
      if (!fragment || result.has(fragment.id)) continue;
      result.add(fragment.id);
      stack.push(...fragment.fragmentSpreads);
    }

    this._reachableFragments.set(definition.id, result);
    return result;
  }

  /** Operation ids that reach a fragment directly or transitively. */
  getOperationsReachingFragment(fragmentId: string): Set<string> {
    if (!this._operationsReachingFragment) {
      const map = new Map<string, Set<string>>();
      for (const operation of this._definitions) {
        if (operation.defKind !== 'operation') continue;
        for (const reachableId of this.getRecursivelyReferencedFragments(operation)) {
          let set = map.get(reachableId);
          if (!set) map.set(reachableId, (set = new Set()));
          set.add(operation.id);
        }
      }
      this._operationsReachingFragment = map;
    }
    return this._operationsReachingFragment.get(fragmentId) || new Set();
  }

  /* -- Module dependency graph (static imports) -- */

  /** The "area" a module belongs to: its directory, relative to the cwd. Used
   * to group insights by feature/area of the codebase. */
  areaOf(modulePath: string): string {
    const rel = path.relative(CWD, modulePath);
    const dir = path.dirname(!rel.startsWith('..') ? rel : modulePath);
    return dir === '.' ? '(root)' : dir;
  }

  /** Modules that nothing else imports — the roots of the dependency graph
   * (routes, entry files, dead leaves). */
  getEntryPoints(): Set<string> {
    if (this._entryPoints) return this._entryPoints;
    const nodes = new Set<string>();
    const targets = new Set<string>();
    for (const [from, tos] of this._importGraph) {
      nodes.add(from);
      for (const to of tos) {
        nodes.add(to);
        targets.add(to);
      }
    }
    this._entryPoints = new Set([...nodes].filter((node) => !targets.has(node)));
    return this._entryPoints;
  }

  /** Modules that transitively import the given module (its reverse closure). */
  getDependents(modulePath: string): Set<string> {
    const cached = this._dependents.get(modulePath);
    if (cached) return cached;

    if (!this._reverseGraph) {
      const reverse = new Map<string, Set<string>>();
      for (const [from, tos] of this._importGraph) {
        for (const to of tos) {
          let importers = reverse.get(to);
          if (!importers) reverse.set(to, (importers = new Set()));
          importers.add(from);
        }
      }
      this._reverseGraph = reverse;
    }

    const result = new Set<string>();
    const stack = [...(this._reverseGraph.get(modulePath) || [])];
    let node: string | undefined;
    while ((node = stack.pop())) {
      if (result.has(node)) continue;
      result.add(node);
      stack.push(...(this._reverseGraph.get(node) || []));
    }

    this._dependents.set(modulePath, result);
    return result;
  }

  /** Shortest distance from any entry point to the module (entry points are 0). */
  getDistanceFromEntry(modulePath: string): number | undefined {
    if (!this._distanceFromEntry) {
      const distance = new Map<string, number>();
      let frontier = [...this.getEntryPoints()];
      let depth = 0;
      while (frontier.length) {
        const next: string[] = [];
        for (const node of frontier) {
          if (distance.has(node)) continue;
          distance.set(node, depth);
          for (const to of this._importGraph.get(node) || []) {
            if (!distance.has(to)) next.push(to);
          }
        }
        frontier = next;
        depth++;
      }
      this._distanceFromEntry = distance;
    }
    return this._distanceFromEntry.get(modulePath);
  }

  /** The blast radius of a module: itself plus everything that depends on it,
   * with the areas and entry points covered. */
  getModuleReach(modulePath: string): {
    modules: string[];
    areas: string[];
    entryPoints: string[];
  } {
    const entryPoints = this.getEntryPoints();
    const modules = new Set<string>([modulePath, ...this.getDependents(modulePath)]);
    const areas = new Set<string>();
    const reachedEntries = new Set<string>();
    for (const module of modules) {
      areas.add(this.areaOf(module));
      if (entryPoints.has(module)) reachedEntries.add(module);
    }
    return {
      modules: [...modules],
      areas: [...areas].sort(),
      entryPoints: [...reachedEntries],
    };
  }

  /* -- Construction -- */

  private _addWarning(message: string, doc: RawScanDocument): void {
    this._warnings.push({ message, file: doc.filePath, line: doc.line, col: doc.col });
  }

  private _uniqueId(base: string): string {
    if (!this._recordById.has(base)) return base;
    let n = 2;
    while (this._recordById.has(`${base}#${n}`)) n++;
    return `${base}#${n}`;
  }

  private _register(record: DefinitionRecord): void {
    this._definitions.push(record);
    this._recordByNode.set(record.node, record);
    this._recordById.set(record.id, record);
    // Keep the AST node and discriminant internal; expose only clean identities.
    if (record.defKind === 'operation') {
      const { node: _node, defKind: _defKind, ...info } = record;
      this._operations.push(info);
    } else {
      const { node: _node, defKind: _defKind, ...info } = record;
      this._fragments.push(info);
      this._fragmentIdByName.set(fragmentKey(record.schemaName, record.name), record.id);
    }
  }

  private _buildCorpus(documents: RawScanDocument[]): void {
    let anonCount = 0;
    for (const doc of documents) {
      if (!this._schemas.has(doc.schemaName)) {
        this._addWarning(
          `No schema was loaded for ${doc.schemaName ? `'${doc.schemaName}'` : 'the default schema'}.`,
          doc
        );
        continue;
      }

      let definitions: readonly DefinitionNode[];
      try {
        definitions = parse(doc.document, { noLocation: true }).definitions;
      } catch (error) {
        this._addWarning(
          `The document could not be parsed. Run \`check\` to see validation errors.\n` +
            `${error instanceof Error ? error.message : error}`,
          doc
        );
        continue;
      }

      const loc = { file: doc.filePath, line: doc.line, col: doc.col };
      for (const definition of definitions) {
        if (definition.kind === Kind.OPERATION_DEFINITION) {
          const op = definition as OperationDefinitionNode;
          const name = op.name ? op.name.value : null;
          const id = this._uniqueId(
            `${doc.schemaName ?? ''}:operation:${name ?? `anonymous-${++anonCount}`}`
          );
          this._register({
            defKind: 'operation',
            node: op,
            id,
            name,
            kind: op.operation,
            schemaName: doc.schemaName,
            module: doc.filePath,
            loc,
            variables: (op.variableDefinitions || []).map((v) => v.variable.name.value),
            fragmentSpreads: collectFragmentSpreads(op),
            hash: hashOf(print(op)),
            typeSize: doc.typeSize,
          });
        } else if (definition.kind === Kind.FRAGMENT_DEFINITION) {
          const fragment = definition as FragmentDefinitionNode;
          const id = this._uniqueId(`${doc.schemaName ?? ''}:fragment:${fragment.name.value}`);
          this._register({
            defKind: 'fragment',
            node: fragment,
            id,
            name: fragment.name.value,
            typeCondition: fragment.typeCondition.name.value,
            schemaName: doc.schemaName,
            module: doc.filePath,
            loc,
            fragmentSpreads: collectFragmentSpreads(fragment),
            hash: hashOf(print(fragment)),
          });
        }
      }
    }
  }

  private _buildModules(imports: Map<string, string[]>): ModuleInfo[] {
    const byPath = new Map<string, ModuleInfo>();
    const ensure = (modulePath: string): ModuleInfo => {
      let info = byPath.get(modulePath);
      if (!info) {
        info = {
          path: modulePath,
          relativePath: path.relative(CWD, modulePath) || modulePath,
          operations: [],
          fragments: [],
          imports: [],
        };
        byPath.set(modulePath, info);
      }
      return info;
    };

    for (const op of this._operations) ensure(op.module).operations.push(op.id);
    for (const fragment of this._fragments) ensure(fragment.module).fragments.push(fragment.id);

    for (const info of byPath.values()) {
      const resolved = imports.get(info.path);
      if (resolved) {
        for (const target of resolved) {
          if (target !== info.path && byPath.has(target)) info.imports.push(target);
        }
      }
    }

    return [...byPath.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  }
}
