import type { GraphQLResolveInfo } from 'graphql';
import { GraphQLError } from 'graphql';

import type { FieldResolver, SchemaPlugin } from './plugin';

export interface MaskErrorsPluginOptions {
  /** The message of masked errors. Defaults to `'Unexpected error.'`. */
  message?: string;
  /** Receives each masked error, e.g. to log it. */
  onError?(error: unknown, info: GraphQLResolveInfo): void;
}

/** Replaces errors that resolvers throw or return with a generic error, unless they're `GraphQLError`s.
 *
 * @remarks
 * Pass it first to `plugins`, so that it also masks errors of other plugins. It only covers
 * resolvers and `subscribe` functions, not errors of events that a subscription emits.
 */
export function maskErrorsPlugin(options: MaskErrorsPluginOptions = {}): SchemaPlugin {
  const message = options.message || 'Unexpected error.';

  const mask = (error: unknown, info: GraphQLResolveInfo): GraphQLError => {
    if (error instanceof GraphQLError) return error;
    if (options.onError) options.onError(error, info);
    return new GraphQLError(message, { extensions: { code: 'INTERNAL_SERVER_ERROR' } });
  };

  const wrap =
    (next: FieldResolver): FieldResolver =>
    (source, args, context, info) => {
      let result: unknown;
      try {
        result = next(source, args, context, info);
      } catch (error) {
        throw mask(error, info);
      }
      if (result instanceof Error) return mask(result, info);
      if (result && typeof (result as Promise<unknown>).then === 'function')
        return (result as Promise<unknown>).then(
          (value) => (value instanceof Error ? mask(value, info) : value),
          (error) => {
            throw mask(error, info);
          }
        );
      return result;
    };

  return { name: 'maskErrors', wrapResolve: wrap, wrapSubscribe: wrap };
}
