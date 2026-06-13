import type { ScanRule, RuleDatapoint } from '../types';
import { allSchemaFields } from '../schema-util';

export interface FieldUsageData {
  typeName: string;
  fieldName: string;
  fieldType: string;
  deprecated: boolean;
  deprecationReason?: string | undefined;
  count: number;
  directUsages: { defId: string; module: string }[];
  /** Operation ids that reach this field directly or transitively. */
  operations: string[];
  /** Blast radius: how much of the codebase transitively depends on this field. */
  reach: { modules: number; areas: string[]; entryPoints: number };
}

interface Accumulated {
  typeName: string;
  fieldName: string;
  fieldType?: string;
  deprecationReason?: string;
  directUsages: { defId: string; module: string }[];
}

/** Builds the per-field usage index: which operations/fragments select each
 * schema coordinate. This is the substrate the annotated schema and the
 * `--field`/`--module` queries are rendered from. */
export const fieldUsage: ScanRule<FieldUsageData> = {
  name: 'field-usage',
  description: 'Per-field usage index keyed by schema coordinate.',
  create(context) {
    const byCoordinate = new Map<string, Accumulated>();
    let seen = new Set<string>();

    const resetSeen = () => void (seen = new Set());

    return {
      visitor: {
        OperationDefinition: { enter: resetSeen },
        FragmentDefinition: { enter: resetSeen },
        Field: {
          enter() {
            const parentType = context.getParentType();
            const fieldDef = context.getFieldDef();
            const definition = context.getCurrentDefinition();
            if (!parentType || !fieldDef || !definition) return;

            const coordinate = `${parentType.name}.${fieldDef.name}`;
            if (seen.has(coordinate)) return;
            seen.add(coordinate);

            let entry = byCoordinate.get(coordinate);
            if (!entry) {
              entry = {
                typeName: parentType.name,
                fieldName: fieldDef.name,
                fieldType: String(fieldDef.type),
                deprecationReason: fieldDef.deprecationReason ?? undefined,
                directUsages: [],
              };
              byCoordinate.set(coordinate, entry);
            }
            entry.directUsages.push({ defId: definition.id, module: definition.module });
          },
        },
      },

      collect() {
        // Reconcile against the schema so unused fields (count 0) appear too.
        for (const field of allSchemaFields(context.getSchemas())) {
          if (!byCoordinate.has(field.coordinate)) {
            byCoordinate.set(field.coordinate, {
              typeName: field.typeName,
              fieldName: field.fieldName,
              fieldType: field.fieldType,
              deprecationReason: field.deprecationReason,
              directUsages: [],
            });
          }
        }

        const operationIds = new Set(context.operations.map((op) => op.id));
        const moduleById = new Map(context.operations.map((op) => [op.id, op.module] as const));
        const graph = context.getModuleGraph();
        const fragments = context.getFragmentGraph();
        const hasEntryPoints = graph.entryPoints().size > 0;
        const datapoints: RuleDatapoint<FieldUsageData>[] = [];
        for (const [coordinate, entry] of byCoordinate) {
          const operations = new Set<string>();
          for (const usage of entry.directUsages) {
            if (operationIds.has(usage.defId)) {
              operations.add(usage.defId);
            } else {
              for (const id of fragments.operationsReaching(usage.defId)) {
                operations.add(id);
              }
            }
          }

          // Blast radius: every module that selects the field, plus the modules
          // of the operations that reach it, expanded by who depends on them.
          const sourceModules = new Set<string>(entry.directUsages.map((usage) => usage.module));
          for (const id of operations) {
            const module = moduleById.get(id);
            if (module) sourceModules.add(module);
          }
          const reachModules = new Set<string>();
          const reachAreas = new Set<string>();
          const reachEntries = new Set<string>();
          for (const module of sourceModules) {
            const reach = graph.reach(module);
            for (const m of reach.modules) reachModules.add(m);
            for (const a of reach.areas) reachAreas.add(a);
            for (const e of reach.entryPoints) reachEntries.add(e);
          }
          const weight = hasEntryPoints ? reachEntries.size : reachModules.size;

          datapoints.push({
            ref: { kind: 'field', coordinate },
            message: `${coordinate} selected ${entry.directUsages.length} time(s)`,
            weight,
            data: {
              typeName: entry.typeName,
              fieldName: entry.fieldName,
              fieldType: entry.fieldType || '',
              deprecated: entry.deprecationReason != null,
              deprecationReason: entry.deprecationReason,
              count: entry.directUsages.length,
              directUsages: entry.directUsages,
              operations: [...operations],
              reach: {
                modules: reachModules.size,
                areas: [...reachAreas].sort(),
                entryPoints: reachEntries.size,
              },
            },
          });
        }
        return datapoints.sort((a, b) =>
          (a.ref as { coordinate: string }).coordinate.localeCompare(
            (b.ref as { coordinate: string }).coordinate
          )
        );
      },
    };
  },
};
