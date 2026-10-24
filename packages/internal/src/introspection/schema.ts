import type { ExecutionResult, GraphQLSchema, IntrospectionQuery } from 'graphql';
import { executeSync } from 'graphql';

import { getPeerSupportedFeatures, makeIntrospectionQuery } from '../loaders/introspection';

/** Runs the introspection query `gql.tada` reads against a local schema.
 *
 * @remarks
 * The query only asks for the introspection fields that the installed `graphql`
 * peer dependency supports, which is what `loadFromSDL` (and hence
 * `gql.tada generate output`) uses for SDL schemas.
 */
export const introspectSchema = (schema: GraphQLSchema): ExecutionResult =>
  executeSync({ schema, document: makeIntrospectionQuery(getPeerSupportedFeatures()) });

/** Parses a JSON introspection result, as `loadFromSDL` (and `gql.tada generate output`) does. */
export const parseIntrospectionJSON = (data: string): IntrospectionQuery => {
  const introspection = JSON.parse(data) as IntrospectionQuery | null;
  if (!introspection || !introspection.__schema) {
    throw new Error(
      'Parsing JSON introspection data failed.\n' +
        'The JSON payload did not evaluate to an introspection schema.'
    );
  }
  return introspection;
};
