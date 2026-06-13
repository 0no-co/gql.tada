import type { ScanCorpus, ScanGraph, ScanGraphNode, ScanGraphEdge, SchemaName } from '../types';
import type { FieldUsageData } from '../rules';

const moduleNodeId = (modulePath: string): string => `module:${modulePath}`;
const fieldNodeId = (coordinate: string): string => `field:${coordinate}`;
const typeNodeId = (typeName: string): string => `type:${typeName}`;
const fragmentKey = (schemaName: SchemaName, name: string): string =>
  `${schemaName ?? ''}\0${name}`;

/** Composes the module ↔ document ↔ schema graph from the corpus (base facts)
 * and the field-usage index (the field selections). The graph is a derived
 * *view*, assembled at output time rather than owned by any rule. */
export function buildGraph(corpus: ScanCorpus, fieldUsage: Map<string, FieldUsageData>): ScanGraph {
  const nodes = new Map<string, ScanGraphNode>();
  const edges: ScanGraphEdge[] = [];
  const addNode = (node: ScanGraphNode): void => {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  };

  const fragmentIdByName = new Map<string, string>();
  for (const fragment of corpus.fragments) {
    fragmentIdByName.set(fragmentKey(fragment.schemaName, fragment.name), fragment.id);
  }

  for (const module of corpus.modules) {
    addNode({ id: moduleNodeId(module.path), kind: 'module', label: module.relativePath });
    for (const target of module.imports) {
      edges.push({ from: moduleNodeId(module.path), to: moduleNodeId(target), kind: 'imports' });
    }
  }

  // Schema field/type nodes only for fields that are actually used.
  for (const [coordinate, usage] of fieldUsage) {
    if (usage.count === 0) continue;
    addNode({ id: fieldNodeId(coordinate), kind: 'schemaField', label: coordinate });
    addNode({ id: typeNodeId(usage.typeName), kind: 'schemaType', label: usage.typeName });
    edges.push({ from: fieldNodeId(coordinate), to: typeNodeId(usage.typeName), kind: 'onType' });
    for (const usageSite of usage.directUsages) {
      edges.push({ from: usageSite.defId, to: fieldNodeId(coordinate), kind: 'selects' });
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

  for (const op of corpus.operations) {
    addDefinition(
      op.id,
      'operation',
      op.name || '(anonymous)',
      op.module,
      op.fragmentSpreads,
      op.schemaName
    );
  }
  for (const fragment of corpus.fragments) {
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
