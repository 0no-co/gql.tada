import type { ExecutionResult, GraphQLSchema } from 'graphql';
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
