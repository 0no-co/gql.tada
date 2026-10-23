import { describe, it, expectTypeOf } from 'vitest';
import { cacheExchange } from '@urql/exchange-graphcache';
import { relayPagination } from '@urql/exchange-graphcache/extras';

import type { simpleIntrospection } from './fixtures/simpleIntrospection';
import type { simpleSchema } from './fixtures/simpleSchema';
import { initGraphQLTada } from '../api';
import type {
  GraphCacheConfig,
  GraphCacheFieldArgsOf,
  GraphCacheFieldValue,
  GraphCacheObject,
  GraphCacheReference,
} from '../addons/graphcache';

const graphql = initGraphQLTada<{ introspection: simpleIntrospection }>();
const preprocessedGraphql = initGraphQLTada<{ introspection: simpleSchema }>();

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

  it('types updaters on non-root types', () => {
    void ({
      updates: {
        Query: {
          todos(parent) {
            expectTypeOf(parent.todos).toEqualTypeOf<Array<GraphCacheObject<
              typeof graphql,
              'Todo'
            > | null> | null>();
          },
        },
        Todo: {
          author(parent, args) {
            expectTypeOf(parent.__typename).toEqualTypeOf<'Todo'>();
            expectTypeOf(parent.text).toEqualTypeOf<string | undefined>();
            expectTypeOf(parent.author).toEqualTypeOf<GraphCacheObject<
              typeof graphql,
              'Author'
            > | null>();
            expectTypeOf(args).toEqualTypeOf<Record<string, never>>();
          },
        },
      },
    } satisfies Config);
  });

  it('rejects resolvers on abstract types', () => {
    void ({
      keys: {
        // @ts-expect-error
        ITodo: () => null,
      },
      resolvers: {
        // @ts-expect-error
        ITodo: {},
      },
    } satisfies Config);
  });

  it('checks resolver results', () => {
    void ({
      resolvers: {
        Query: {
          todos(_parent, _args, cache) {
            return cache.resolve('Query', 'todos');
          },
          // @ts-expect-error
          latestTodo() {
            return 42;
          },
        },
        Todo: {
          author(parent, _args, cache) {
            return cache.keyOfEntity({ __typename: 'Author', id: parent.id });
          },
          // @ts-expect-error
          complete() {
            return 'yes';
          },
        },
      },
    } satisfies Config);
  });

  it('types cache.resolve through references and root keys', () => {
    void ({
      resolvers: {
        Todo: {
          text(parent, _args, cache) {
            const author = cache.resolve(parent, 'author');
            const name = cache.resolve(author, 'name');
            expectTypeOf(name).toEqualTypeOf<string | undefined>();
            const todos = cache.resolve('Query', 'todos');
            expectTypeOf(todos).toEqualTypeOf<
              | Array<GraphCacheReference<GraphCacheObject<typeof graphql, 'Todo'>> | null>
              | null
              | undefined
            >();
            const untyped = cache.resolve('Todo:1', 'text');
            expectTypeOf(untyped).not.toBeAny();
            return name;
          },
        },
      },
    } satisfies Config);
  });

  it('is compatible with cacheExchange', () => {
    const config = {
      keys: { Todo: (data) => data.id || null },
      resolvers: {
        Query: { todos: relayPagination() },
        Todo: { author: (parent) => ({ __typename: 'Author', id: parent.id }) },
      },
      updates: {
        Mutation: {
          toggleTodo(_result, args, cache) {
            cache.invalidate({ __typename: 'Todo', id: args.id });
          },
        },
      },
    } satisfies Config;
    cacheExchange(config);
  });

  it('maps unconfigured custom scalars to Graphcache scalars', () => {
    type schema = {
      name: never;
      query: 'Query';
      mutation: never;
      subscription: never;
      types: {
        DateTime: unknown;
        Query: {
          kind: 'OBJECT';
          name: 'Query';
          fields: {
            since: {
              name: 'since';
              type: { kind: 'SCALAR'; name: 'DateTime'; ofType: null };
              args: [
                {
                  name: 'from';
                  type: {
                    kind: 'NON_NULL';
                    name: never;
                    ofType: { kind: 'SCALAR'; name: 'DateTime'; ofType: null };
                  };
                  defaultValue: null;
                },
              ];
            };
          };
        };
      };
    };

    const scalarGraphql = initGraphQLTada<{ introspection: schema }>();
    const config = {
      resolvers: {
        Query: {
          since(parent, args) {
            expectTypeOf(args.from).not.toBeUnknown();
            expectTypeOf(parent.since).not.toBeUnknown();
            return args.from;
          },
        },
      },
    } satisfies GraphCacheConfig<typeof scalarGraphql>;
    cacheExchange(config);
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
    expectTypeOf<
      GraphCacheFieldArgsOf<typeof preprocessedGraphql, 'Mutation', 'updateTodo'>
    >().toEqualTypeOf<{
      id: string;
      input: {
        title: string;
        description: string;
        complete?: boolean | null | undefined;
      };
    }>();
  });
});
