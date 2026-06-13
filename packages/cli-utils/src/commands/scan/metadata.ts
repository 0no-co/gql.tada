import * as crypto from 'node:crypto';
import * as path from 'node:path';
import {
  parse,
  print,
  visit,
  visitWithTypeInfo,
  TypeInfo,
  Kind,
  isObjectType,
  isInterfaceType,
} from 'graphql';
import type { GraphQLSchema, DefinitionNode, OperationDefinitionNode } from 'graphql';

import type {
  SchemaName,
  RawScanDocument,
  ScanWarning,
  ScanMetadata,
  ModuleInfo,
  OperationInfo,
  FragmentInfo,
  FieldIndexEntry,
  SchemaCoverage,
  TypeCoverage,
  ScanGraph,
  ScanGraphNode,
  ScanGraphEdge,
} from './types';

const CWD = process.cwd();

export interface BuildMetadataParams {
  documents: RawScanDocument[];
  /** Loaded schema per schema name (`null` for the unnamed/default schema). */
  schemas: Map<SchemaName, GraphQLSchema>;
  /** Resolved import paths per module, keyed by absolute module path. */
  imports: Map<string, string[]>;
  /** Warnings already surfaced by the discovery worker. */
  warnings: ScanWarning[];
}

const hashOf = (input: string): string =>
  crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);

const moduleNodeId = (modulePath: string): string => `module:${modulePath}`;
const fieldNodeId = (coordinate: string): string => `field:${coordinate}`;
const typeNodeId = (typeName: string): string => `type:${typeName}`;

const fragmentKey = (schemaName: SchemaName, name: string): string =>
  `${schemaName ?? ''}\0${name}`;

interface DefinitionAnalysis {
  fields: string[];
  fieldDetails: Map<
    string,
    { typeName: string; fieldName: string; fieldType: string; deprecationReason?: string }
  >;
  spreads: string[];
  depth: number;
  fieldCount: number;
}

/** Walks a single operation or fragment definition against the schema, keying
 * each field selection to its schema coordinate (`Type.field`). Named fragment
 * spreads are recorded as edges but not descended into — each definition's own
 * selections are counted once. */
function analyseDefinition(node: DefinitionNode, schema: GraphQLSchema): DefinitionAnalysis {
  const typeInfo = new TypeInfo(schema);
  const fields = new Set<string>();
  const fieldDetails: DefinitionAnalysis['fieldDetails'] = new Map();
  const spreads = new Set<string>();
  let depth = 0;
  let maxDepth = 0;
  let fieldCount = 0;

  visit(
    node,
    visitWithTypeInfo(typeInfo, {
      SelectionSet: {
        enter() {
          if (++depth > maxDepth) maxDepth = depth;
        },
        leave() {
          depth--;
        },
      },
      FragmentSpread: {
        enter(spread) {
          spreads.add(spread.name.value);
        },
      },
      Field: {
        enter() {
          fieldCount++;
          const parentType = typeInfo.getParentType();
          const fieldDef = typeInfo.getFieldDef();
          if (parentType && fieldDef) {
            const coordinate = `${parentType.name}.${fieldDef.name}`;
            if (!fields.has(coordinate)) {
              fields.add(coordinate);
              fieldDetails.set(coordinate, {
                typeName: parentType.name,
                fieldName: fieldDef.name,
                fieldType: String(fieldDef.type),
                deprecationReason: fieldDef.deprecationReason ?? undefined,
              });
            }
          }
        },
      },
    })
  );

  return { fields: [...fields], fieldDetails, spreads: [...spreads], depth: maxDepth, fieldCount };
}

/** Builds the full {@link ScanMetadata} from discovered documents and schemas.
 *
 * This is the pure "metadata layer": no I/O, no terminal access. */
export function buildMetadata(params: BuildMetadataParams): ScanMetadata {
  const { schemas } = params;
  const warnings: ScanWarning[] = [...params.warnings];

  const operations: OperationInfo[] = [];
  const fragments: FragmentInfo[] = [];
  const operationById = new Map<string, OperationInfo>();
  const fragmentById = new Map<string, FragmentInfo>();
  const fragmentIdByName = new Map<string, string>();
  const fieldIndex: Record<string, FieldIndexEntry> = {};
  const usedIds = new Set<string>();

  const uniqueId = (base: string): string => {
    if (!usedIds.has(base)) {
      usedIds.add(base);
      return base;
    }
    let n = 2;
    while (usedIds.has(`${base}#${n}`)) n++;
    const id = `${base}#${n}`;
    usedIds.add(id);
    return id;
  };

  const recordFieldUsage = (analysis: DefinitionAnalysis, defId: string, module: string): void => {
    for (const coordinate of analysis.fields) {
      const detail = analysis.fieldDetails.get(coordinate)!;
      let entry = fieldIndex[coordinate];
      if (!entry) {
        entry = fieldIndex[coordinate] = {
          coordinate,
          typeName: detail.typeName,
          fieldName: detail.fieldName,
          fieldType: detail.fieldType,
          deprecated: detail.deprecationReason != null,
          deprecationReason: detail.deprecationReason,
          directUsages: [],
          count: 0,
          operations: [],
        };
      }
      entry.directUsages.push({ defId, module });
      entry.count = entry.directUsages.length;
    }
  };

  let anonCount = 0;
  for (const doc of params.documents) {
    const schema = schemas.get(doc.schemaName);
    if (!schema) {
      warnings.push({
        message: `No schema was loaded for ${doc.schemaName ? `'${doc.schemaName}'` : 'the default schema'}.`,
        file: doc.filePath,
        line: doc.line,
        col: doc.col,
      });
      continue;
    }

    let definitions: readonly DefinitionNode[];
    try {
      definitions = parse(doc.document, { noLocation: true }).definitions;
    } catch (error) {
      warnings.push({
        message:
          `The document could not be parsed. Run \`check\` to see validation errors.\n` +
          `${error instanceof Error ? error.message : error}`,
        file: doc.filePath,
        line: doc.line,
        col: doc.col,
      });
      continue;
    }

    for (const definition of definitions) {
      if (definition.kind === Kind.OPERATION_DEFINITION) {
        const op = definition as OperationDefinitionNode;
        const analysis = analyseDefinition(op, schema);
        const name = op.name ? op.name.value : null;
        const hash = hashOf(print(op));
        const id = uniqueId(
          `${doc.schemaName ?? ''}:operation:${name ?? `anonymous-${++anonCount}`}`
        );
        const info: OperationInfo = {
          id,
          name,
          kind: op.operation,
          schemaName: doc.schemaName,
          module: doc.filePath,
          loc: { file: doc.filePath, line: doc.line, col: doc.col },
          variables: (op.variableDefinitions || []).map((v) => v.variable.name.value),
          fragmentSpreads: analysis.spreads,
          fields: analysis.fields,
          depth: analysis.depth,
          fieldCount: analysis.fieldCount,
          hash,
          typeSize: doc.typeSize,
        };
        operations.push(info);
        operationById.set(id, info);
        recordFieldUsage(analysis, id, doc.filePath);
      } else if (definition.kind === Kind.FRAGMENT_DEFINITION) {
        const analysis = analyseDefinition(definition, schema);
        const name = definition.name.value;
        const hash = hashOf(print(definition));
        const id = uniqueId(`${doc.schemaName ?? ''}:fragment:${name}`);
        const info: FragmentInfo = {
          id,
          name,
          typeCondition: definition.typeCondition.name.value,
          schemaName: doc.schemaName,
          module: doc.filePath,
          loc: { file: doc.filePath, line: doc.line, col: doc.col },
          fragmentSpreads: analysis.spreads,
          fields: analysis.fields,
          hash,
        };
        fragments.push(info);
        fragmentById.set(id, info);
        fragmentIdByName.set(fragmentKey(doc.schemaName, name), id);
        recordFieldUsage(analysis, id, doc.filePath);
      }
    }
  }

  // Resolve transitive operation reach: which operations reach each fragment
  // (directly or via nested fragment spreads).
  const operationsReachingFragment = new Map<string, Set<string>>();
  for (const op of operations) {
    const reachable = reachableFragments(op.fragmentSpreads, op.schemaName, {
      fragmentIdByName,
      fragmentById,
    });
    for (const fragmentId of reachable) {
      let set = operationsReachingFragment.get(fragmentId);
      if (!set) operationsReachingFragment.set(fragmentId, (set = new Set()));
      set.add(op.id);
    }
  }

  for (const entry of Object.values(fieldIndex)) {
    const ops = new Set<string>();
    for (const usage of entry.directUsages) {
      if (operationById.has(usage.defId)) {
        ops.add(usage.defId);
      } else {
        const reaching = operationsReachingFragment.get(usage.defId);
        if (reaching) for (const opId of reaching) ops.add(opId);
      }
    }
    entry.operations = [...ops];
  }

  // Enrich the field index with every schema field, so unused fields (count 0)
  // are represented too. This makes the index the authoritative field map.
  populateSchemaFields(schemas, fieldIndex);

  const coverage = computeCoverage(fieldIndex);
  const modules = buildModules(operations, fragments, params.imports);
  const graph = buildGraph(modules, operations, fragments, fieldIndex, fragmentIdByName);

  return {
    schemas: [...schemas.keys()],
    modules,
    operations,
    fragments,
    fieldIndex,
    coverage,
    graph,
    warnings,
  };
}

function reachableFragments(
  startSpreads: readonly string[],
  schemaName: SchemaName,
  registry: { fragmentIdByName: Map<string, string>; fragmentById: Map<string, FragmentInfo> }
): Set<string> {
  const result = new Set<string>();
  const stack = [...startSpreads];
  while (stack.length) {
    const name = stack.pop()!;
    const fragmentId = registry.fragmentIdByName.get(fragmentKey(schemaName, name));
    if (!fragmentId || result.has(fragmentId)) continue;
    result.add(fragmentId);
    const fragment = registry.fragmentById.get(fragmentId);
    if (fragment) for (const spread of fragment.fragmentSpreads) stack.push(spread);
  }
  return result;
}

function populateSchemaFields(
  schemas: Map<SchemaName, GraphQLSchema>,
  fieldIndex: Record<string, FieldIndexEntry>
): void {
  for (const schema of schemas.values()) {
    for (const type of Object.values(schema.getTypeMap())) {
      if (type.name.startsWith('__')) continue;
      if (!isObjectType(type) && !isInterfaceType(type)) continue;
      for (const field of Object.values(type.getFields())) {
        const coordinate = `${type.name}.${field.name}`;
        if (!fieldIndex[coordinate]) {
          fieldIndex[coordinate] = {
            coordinate,
            typeName: type.name,
            fieldName: field.name,
            fieldType: String(field.type),
            deprecated: field.deprecationReason != null,
            deprecationReason: field.deprecationReason ?? undefined,
            directUsages: [],
            count: 0,
            operations: [],
          };
        }
      }
    }
  }
}

function computeCoverage(fieldIndex: Record<string, FieldIndexEntry>): SchemaCoverage {
  const byType = new Map<string, TypeCoverage>();
  let totalFields = 0;
  let usedFields = 0;

  for (const entry of Object.values(fieldIndex)) {
    let coverage = byType.get(entry.typeName);
    if (!coverage) {
      byType.set(
        entry.typeName,
        (coverage = { typeName: entry.typeName, totalFields: 0, usedFields: 0 })
      );
    }
    coverage.totalFields++;
    totalFields++;
    if (entry.count > 0) {
      coverage.usedFields++;
      usedFields++;
    }
  }

  const perType = [...byType.values()].sort((a, b) => a.typeName.localeCompare(b.typeName));
  return { totalFields, usedFields, perType };
}

function buildModules(
  operations: OperationInfo[],
  fragments: FragmentInfo[],
  imports: Map<string, string[]>
): ModuleInfo[] {
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

  for (const op of operations) ensure(op.module).operations.push(op.id);
  for (const fragment of fragments) ensure(fragment.module).fragments.push(fragment.id);

  // Only keep import edges that point at other scanned modules.
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

function buildGraph(
  modules: ModuleInfo[],
  operations: OperationInfo[],
  fragments: FragmentInfo[],
  fieldIndex: Record<string, FieldIndexEntry>,
  fragmentIdByName: Map<string, string>
): ScanGraph {
  const nodes = new Map<string, ScanGraphNode>();
  const edges: ScanGraphEdge[] = [];
  const addNode = (node: ScanGraphNode): void => {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  };

  for (const module of modules) {
    addNode({ id: moduleNodeId(module.path), kind: 'module', label: module.relativePath });
    for (const target of module.imports) {
      edges.push({ from: moduleNodeId(module.path), to: moduleNodeId(target), kind: 'imports' });
    }
  }

  // Schema field/type nodes are only emitted for fields that are actually used,
  // to keep the graph bounded.
  for (const entry of Object.values(fieldIndex)) {
    if (entry.count === 0) continue;
    addNode({ id: fieldNodeId(entry.coordinate), kind: 'schemaField', label: entry.coordinate });
    addNode({ id: typeNodeId(entry.typeName), kind: 'schemaType', label: entry.typeName });
    edges.push({
      from: fieldNodeId(entry.coordinate),
      to: typeNodeId(entry.typeName),
      kind: 'onType',
    });
  }

  const addDefinition = (
    id: string,
    kind: 'operation' | 'fragment',
    label: string,
    module: string,
    spreads: readonly string[],
    fields: readonly string[],
    schemaName: SchemaName
  ): void => {
    addNode({ id, kind, label });
    edges.push({ from: moduleNodeId(module), to: id, kind: 'defines' });
    for (const spreadName of spreads) {
      const target = fragmentIdByName.get(fragmentKey(schemaName, spreadName));
      if (target) edges.push({ from: id, to: target, kind: 'spreads' });
    }
    for (const coordinate of fields) {
      if (fieldIndex[coordinate]) {
        edges.push({ from: id, to: fieldNodeId(coordinate), kind: 'selects' });
      }
    }
  };

  for (const op of operations) {
    addDefinition(
      op.id,
      'operation',
      op.name || '(anonymous)',
      op.module,
      op.fragmentSpreads,
      op.fields,
      op.schemaName
    );
  }
  for (const fragment of fragments) {
    addDefinition(
      fragment.id,
      'fragment',
      fragment.name,
      fragment.module,
      fragment.fragmentSpreads,
      fragment.fields,
      fragment.schemaName
    );
  }

  return { nodes: [...nodes.values()], edges };
}
