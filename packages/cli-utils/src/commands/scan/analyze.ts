import { visit, visitInParallel, visitWithTypeInfo, TypeInfo, Kind } from 'graphql';
import type { DocumentNode } from 'graphql';

import { ScanContext } from './context';
import type { ScanContextParams } from './context';
import { DEFAULT_RULES } from './rules';
import type { ScanRule, RuleResults } from './types';

export interface ScanAnalysis {
  context: ScanContext;
  rules: RuleResults;
}

/**
 * Runs the analysis: builds the context (corpus + primitives), then walks every
 * definition once per schema with all rule visitors merged in parallel —
 * mirroring graphql-js `validate`. Each rule accumulates its own state during
 * the traversal and converts it to datapoints in `collect()`.
 */
export function analyze(
  params: ScanContextParams,
  rules: ScanRule[] = DEFAULT_RULES
): ScanAnalysis {
  const context = new ScanContext(params);
  const instances = rules.map((rule) => ({ name: rule.name, instance: rule.create(context) }));

  for (const [schemaName, schema] of context.getSchemas()) {
    const definitions = context.definitionNodesForSchema(schemaName);
    if (!definitions.length) continue;

    const typeInfo = new TypeInfo(schema);
    context.setTypeInfo(typeInfo);

    // A fresh `visitInParallel` per schema (its skip-state is per-call), but the
    // same rule instances, so their accumulated state carries across schemas.
    const visitor = visitInParallel([
      context.trackingVisitor(),
      ...instances.map(({ instance }) => instance.visitor),
    ]);

    const document: DocumentNode = { kind: Kind.DOCUMENT, definitions };
    visit(document, visitWithTypeInfo(typeInfo, visitor));
  }

  const results: RuleResults = {};
  for (const { name, instance } of instances) results[name] = instance.collect();
  return { context, rules: results };
}
