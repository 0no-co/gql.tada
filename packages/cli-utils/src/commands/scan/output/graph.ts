import type { ScanContext } from '../context';
import type { RuleResults, ScanGraph, ScanGraphNode, ScanGraphEdge, SchemaName } from '../types';
import type { FieldUsageData } from '../rules';

const moduleNodeId = (modulePath: string): string => `module:${modulePath}`;
const fieldNodeId = (coordinate: string): string => `field:${coordinate}`;
const typeNodeId = (typeName: string): string => `type:${typeName}`;
const fragmentKey = (schemaName: SchemaName, name: string): string =>
  `${schemaName ?? ''}\0${name}`;

/** Serialises the pure relationship graph (emitted via `--graph`). */
export function renderGraph(context: ScanContext, rules: RuleResults): string {
  return JSON.stringify(buildGraph(context, rules), null, 2) + '\n';
}

/** Composes the module ↔ document ↔ fragment ↔ schema relationship graph from
 * the corpus (identities, spreads, imports) and the field-usage rule (the
 * field selections). A derived view assembled at output time. */
export function buildGraph(context: ScanContext, rules: RuleResults): ScanGraph {
  const nodes = new Map<string, ScanGraphNode>();
  const edges: ScanGraphEdge[] = [];
  const addNode = (node: ScanGraphNode): void => {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  };

  const fragmentIdByName = new Map<string, string>();
  for (const fragment of context.fragments) {
    fragmentIdByName.set(fragmentKey(fragment.schemaName, fragment.name), fragment.id);
  }

  for (const module of context.modules) {
    addNode({ id: moduleNodeId(module.path), kind: 'module', label: module.relativePath });
    for (const target of module.imports) {
      edges.push({ from: moduleNodeId(module.path), to: moduleNodeId(target), kind: 'imports' });
    }
  }

  // Schema field/type nodes + `selects` edges come from the field-usage rule
  // (which only indexes used fields, so the graph is bounded to what's used).
  for (const datapoint of rules['field-usage'] || []) {
    if (datapoint.ref.kind !== 'field') continue;
    const coordinate = datapoint.ref.coordinate;
    const usage = datapoint.data as FieldUsageData;
    addNode({ id: fieldNodeId(coordinate), kind: 'schemaField', label: coordinate });
    addNode({ id: typeNodeId(usage.typeName), kind: 'schemaType', label: usage.typeName });
    edges.push({ from: fieldNodeId(coordinate), to: typeNodeId(usage.typeName), kind: 'onType' });
    for (const site of usage.directUsages) {
      edges.push({ from: site.defId, to: fieldNodeId(coordinate), kind: 'selects' });
    }
  }

  const addDefinition = (
    id: string,
    kind: 'operation' | 'fragment',
    label: string,
    module: string,
    spreads: readonly string[],
    schemaName: SchemaName
  ): void => {
    addNode({ id, kind, label });
    edges.push({ from: moduleNodeId(module), to: id, kind: 'defines' });
    for (const spreadName of spreads) {
      const target = fragmentIdByName.get(fragmentKey(schemaName, spreadName));
      if (target) edges.push({ from: id, to: target, kind: 'spreads' });
    }
  };

  for (const op of context.operations) {
    addDefinition(
      op.id,
      'operation',
      op.name || '(anonymous)',
      op.module,
      op.fragmentSpreads,
      op.schemaName
    );
  }
  for (const fragment of context.fragments) {
    addDefinition(
      fragment.id,
      'fragment',
      fragment.name,
      fragment.module,
      fragment.fragmentSpreads,
      fragment.schemaName
    );
  }

  return { nodes: [...nodes.values()], edges };
}
