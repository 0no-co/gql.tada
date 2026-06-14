import { isObjectType, isInterfaceType } from 'graphql';
import type { GraphQLSchema } from 'graphql';

import type { SchemaName } from './types';

export interface SchemaFieldInfo {
  coordinate: string;
  typeName: string;
  fieldName: string;
  fieldType: string;
  deprecationReason?: string | undefined;
}

/** Enumerates every object/interface field across the schemas, deduped by
 * coordinate. A pure helper rules use to reconcile usage against the schema. */
export function allSchemaFields(schemas: Map<SchemaName, GraphQLSchema>): SchemaFieldInfo[] {
  const seen = new Map<string, SchemaFieldInfo>();
  for (const schema of schemas.values()) {
    for (const type of Object.values(schema.getTypeMap())) {
      if (type.name.startsWith('__')) continue;
      if (!isObjectType(type) && !isInterfaceType(type)) continue;
      for (const field of Object.values(type.getFields())) {
        const coordinate = `${type.name}.${field.name}`;
        if (!seen.has(coordinate)) {
          seen.set(coordinate, {
            coordinate,
            typeName: type.name,
            fieldName: field.name,
            fieldType: String(field.type),
            deprecationReason: field.deprecationReason ?? undefined,
          });
        }
      }
    }
  }
  return [...seen.values()];
}
