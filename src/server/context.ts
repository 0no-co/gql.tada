/** Creates a function that returns one value per context object.
 *
 * @param create - A function creating the value for a given context.
 * @returns A function returning the value for a given context, which is created once per context.
 *
 * @remarks
 * Resolvers receive the same context object for the duration of a request. This creates values
 * that are shared by all resolvers of a request, such as a `DataLoader` batching lookups, without
 * having to create them upfront when the context is created.
 *
 * @example
 * ```ts
 * import DataLoader from 'dataloader';
 * import { createContextCache } from 'gql.tada/server';
 *
 * const userLoader = createContextCache(
 *   (context: Context) => new DataLoader((ids: readonly string[]) => context.db.getUsers(ids))
 * );
 *
 * // In a resolver:
 * resolve: (post, _args, context) => userLoader(context).load(post.authorId),
 * ```
 */
export function createContextCache<Context extends object, Value>(
  create: (context: Context) => Value
): (context: Context) => Value {
  const cache = new WeakMap<Context, Value>();
  return (context) => {
    if (context == null || (typeof context !== 'object' && typeof context !== 'function'))
      throw new TypeError(
        `createContextCache() requires the context to be an object, but received ${
          context === null ? 'null' : typeof context
        }. Make sure that your GraphQL server passes a context value.`
      );
    if (!cache.has(context)) cache.set(context, create(context));
    return cache.get(context)!;
  };
}
