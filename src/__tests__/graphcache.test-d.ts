import { describe, it, expectTypeOf } from 'vitest';

import type { simpleIntrospection } from './fixtures/simpleIntrospection';
import { initGraphQLTada } from '../api';
import type {
  GraphCacheConfig,
  GraphCacheFieldArgsOf,
  GraphCacheFieldValue,
  GraphCacheObject,
  GraphCacheReference,
} from '../addons/graphcache';

const graphql = initGraphQLTada<{ introspection: simpleIntrospection }>();

type Config = GraphCacheConfig<typeof graphql>;

describe('graphcache addon', () => {
  it('types cache exchange config from a gql.tada schema', () => {
    void ({
      keys: {
        Todo: (data) => {
          expectTypeOf(data.__typename).toEqualTypeOf<'Todo'>();
          expectTypeOf(data.id).toEqualTypeOf<string | undefined>();
          return data.id || null;
        },
      },
      updates: {
        Mutation: {
          toggleTodo(result, args, cache) {
            expectTypeOf(result.toggleTodo).toEqualTypeOf<GraphCacheObject<
              typeof graphql,
              'Todo'
            > | null>();
            expectTypeOf(args).toEqualTypeOf<{ id: string }>();
            expectTypeOf(result.toggleTodo?.author?.name).toEqualTypeOf<string | undefined>();

            const complete = cache.resolve({ __typename: 'Todo', id: args.id }, 'complete');
            expectTypeOf(complete).toEqualTypeOf<boolean | null | undefined>();

            const author = cache.resolve({ __typename: 'Todo', id: args.id }, 'author');
            expectTypeOf(author).toEqualTypeOf<
              GraphCacheReference<GraphCacheObject<typeof graphql, 'Author'>> | null | undefined
            >();

            // @ts-expect-error
            cache.resolve({ __typename: 'Todo', id: args.id }, 'missing');
          },
        },
        Subscription: {
          newTodo(result, args) {
            expectTypeOf(result.newTodo).toEqualTypeOf<GraphCacheObject<
              typeof graphql,
              'Todo'
            > | null>();
            expectTypeOf(args).toEqualTypeOf<Record<string, never>>();
          },
        },
      },
      optimistic: {
        toggleTodo(args) {
          expectTypeOf(args).toEqualTypeOf<{ id: string }>();
          return {
            __typename: 'Todo',
            id: args.id,
            complete: true,
          };
        },
        updateTodo(args) {
          expectTypeOf(args).toEqualTypeOf<{
            id: string;
            input: {
              title: string;
              description: string;
              complete?: boolean | null | undefined;
            };
          }>();
          return true;
        },
      },
      resolvers: {
        Query: {
          todos(_parent, args) {
            expectTypeOf(args).toEqualTypeOf<Record<string, never>>();
            return [];
          },
        },
        Todo: {
          author(parent, args, cache) {
            expectTypeOf(args).toEqualTypeOf<Record<string, never>>();
            expectTypeOf(parent.text).toEqualTypeOf<string | undefined>();
            const author = cache.resolve({ __typename: 'Todo', id: parent.id }, 'author');
            expectTypeOf(author).toEqualTypeOf<
              GraphCacheReference<GraphCacheObject<typeof graphql, 'Author'>> | null | undefined
            >();
            return null;
          },
        },
      },
    } satisfies Config);
  });

  it('rejects unknown configured schema fields', () => {
    void ({
      updates: {
        Mutation: {
          // @ts-expect-error
          missing() {},
        },
      },
      resolvers: {
        Todo: {
          // @ts-expect-error
          missing() {
            return null;
          },
        },
      },
    } satisfies Config);
  });

  it('exposes field value and argument helpers', () => {
    expectTypeOf<
      GraphCacheFieldValue<typeof graphql, 'Todo', 'author'>
    >().toEqualTypeOf<GraphCacheObject<typeof graphql, 'Author'> | null>();
    expectTypeOf<GraphCacheFieldArgsOf<typeof graphql, 'Mutation', 'updateTodo'>>().toEqualTypeOf<{
      id: string;
      input: {
        title: string;
        description: string;
        complete?: boolean | null | undefined;
      };
    }>();
  });
});
