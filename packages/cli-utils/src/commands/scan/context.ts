import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { parse, print, visit, Kind } from 'graphql';
import type {
  GraphQLSchema,
  GraphQLCompositeType,
  GraphQLField,
  GraphQLOutputType,
  GraphQLInputType,
  GraphQLEnumValue,
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
} from './types';
import { ModuleGraph } from './module-graph';
import { FragmentGraph } from './fragment-graph';
import type { FragmentGraphDefinition } from './fragment-graph';

const CWD = process.cwd();

export interface ScanContextParams {
  documents: RawScanDocument[];
  schemas: Map<SchemaName, GraphQLSchema>;
  imports: Map<string, string[]>;
  warnings: ScanWarning[];
}

const hashOf = (input: string): string =>
  crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);

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
  private readonly _recordById = new Map<string, DefinitionRecord>();
  private readonly _modules: ModuleInfo[];

  private _typeInfo: TypeInfo | null = null;
  private _currentDefinition: DefinitionRecord | null = null;

  // Static module dependency graph (every scanned file → its project imports).
  private readonly _importGraph: Map<string, string[]>;
  private _moduleGraph: ModuleGraph | undefined;
  private _fragmentGraph: FragmentGraph | undefined;

  constructor(params: ScanContextParams) {
    this._schemas = params.schemas;
    this._warnings = [...params.warnings];
    this._importGraph = params.imports;
    this._buildCorpus(params.documents);
    this._modules = this._buildModules(params.imports);
  }

  /* -- Corpus accessors (base facts) -- */

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

  /** The current output type at this traversal position — the third TypeInfo
   * accessor alongside {@link getParentType} and {@link getFieldDef}. Unused
   * today, but kept as a generic primitive for rules that inspect return types
   * (e.g. list/non-null wrapping) without the context having to grow. */
  getType(): GraphQLOutputType | null | undefined {
    return this._typeInfo?.getType();
  }

  getFieldDef(): GraphQLField<unknown, unknown> | null | undefined {
    return this._typeInfo?.getFieldDef();
  }

  /** The input type expected at this position (argument / input-field / list value). */
  getInputType(): GraphQLInputType | null | undefined {
    return this._typeInfo?.getInputType();
  }

  /** The enclosing input-object type when inside an input object literal. */
  getParentInputType(): GraphQLInputType | null | undefined {
    return this._typeInfo?.getParentInputType();
  }

  /** The enum value definition at the current position, if any. */
  getEnumValue(): GraphQLEnumValue | null | undefined {
    return this._typeInfo?.getEnumValue();
  }

  /* -- Generic primitives for graph-level rules -- */

  /** The project's static module dependency graph, as a reusable structure.
   * All reachability/area analysis lives on it, so graph rules need no bespoke
   * context methods. */
  getModuleGraph(): ModuleGraph {
    return (this._moduleGraph ??= new ModuleGraph(this._importGraph, CWD));
  }

  /** The fragment spread graph (resolution + reachability), as a reusable
   * structure. Built from the corpus, so fragment-graph rules need no bespoke
   * context methods. */
  getFragmentGraph(): FragmentGraph {
    if (!this._fragmentGraph) {
      const definitions: FragmentGraphDefinition[] = [];
      for (const op of this._operations) {
        definitions.push({
          id: op.id,
          kind: 'operation',
          schemaName: op.schemaName,
          fragmentSpreads: op.fragmentSpreads,
        });
      }
      for (const fragment of this._fragments) {
        definitions.push({
          id: fragment.id,
          kind: 'fragment',
          schemaName: fragment.schemaName,
          name: fragment.name,
          fragmentSpreads: fragment.fragmentSpreads,
        });
      }
      this._fragmentGraph = new FragmentGraph(definitions);
    }
    return this._fragmentGraph;
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
            variables: (op.variableDefinitions || []).map((v) => ({
              name: v.variable.name.value,
              type: print(v.type),
              defaultValue: v.defaultValue ? print(v.defaultValue) : undefined,
            })),
            fragmentSpreads: collectFragmentSpreads(op),
            hash: hashOf(print(op)),
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
