import { writeFileSync } from 'node:fs';
import { printSchema } from 'graphql';
import { schema } from './schema/index.ts';

/** Writes `schema.graphql` for GraphQLSP and `gql.tada check`, which validate GraphQL documents.
 * @remarks
 * Types of GraphQL documents are derived from the schema itself and don't need this file.
 */
export function writeSchemaFile() {
  writeFileSync(new URL('../schema.graphql', import.meta.url), printSchema(schema) + '\n');
}
