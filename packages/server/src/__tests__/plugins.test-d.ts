import { describe, it, expectTypeOf } from 'vitest';
import type { GraphQLResolveInfo } from 'graphql';

import type { IntrospectionOf } from 'gql.tada';
import { initSchemaBuilder } from '../builder';
import type { AuthRule } from '../../../../examples/example-server/src/plugins/auth';
import { authPlugin, and, or, not } from '../../../../examples/example-server/src/plugins/auth';
import { maskErrorsPlugin } from '../../../../examples/example-server/src/plugins/maskErrors';
import type { SchemaPlugin } from '../plugin';

declare module '@gql.tada/server' {
  interface FieldPluginOptions<Parent, Context, Args> {
    typedHint?: (parent: Parent, args: Args, context: Context) => string;
  }
}

interface Context {
  userId: string | null;
}

interface PostModel {
  id: string;
  authorId: string;
}

const build = (plugins: readonly SchemaPlugin<Context>[]) => {
  const t = initSchemaBuilder<{ context: Context }>({ plugins });
  const Post = t.objectRef<PostModel>()('Post');
  const PostType = t.object(Post, {
    authorize: (post, _args, ctx) => {
      expectTypeOf(post).toEqualTypeOf<PostModel>();
      expectTypeOf(ctx).toEqualTypeOf<Context>();
      return post.authorId === ctx.userId;
    },
    fields: (f) => ({ id: f.field({ type: t.nonNull(t.ID) }) }),
  });
  const Query = t.object(t.objectRef()('Query'), {
    fields: (f) => ({
      post: f.field({
        type: Post,
        args: { id: t.nonNull(t.ID), draft: t.Boolean },
        authorize: async (parent, args, ctx, info) => {
          expectTypeOf(parent).toEqualTypeOf<unknown>();
          expectTypeOf(args).toEqualTypeOf<{ id: string; draft?: boolean | null }>();
          expectTypeOf(ctx).toEqualTypeOf<Context>();
          expectTypeOf(info).toEqualTypeOf<GraphQLResolveInfo>();
          return ctx.userId != null || new Error('Log in first.');
        },
        typedHint: (_parent, args) => {
          expectTypeOf(args.id).toEqualTypeOf<string>();
          return args.id;
        },
        resolve: () => null,
      }),
    }),
  });
  return t.schema({ query: Query, types: [PostType] });
};

describe('plugin options', () => {
  it('types rules with the parent, arguments, and context', () => {
    build([authPlugin()]);
  });

  it('rejects mistyped options', () => {
    const t = initSchemaBuilder<{ context: Context }>();
    t.object(t.objectRef<PostModel>()('Post'), {
      // @ts-expect-error rules must return a boolean or an Error
      authorize: () => 'yes',
      fields: (f) => ({
        id: f.field({
          type: t.ID,
          args: { id: t.ID },
          // @ts-expect-error the argument isn't a number
          authorize: (_parent, args: { id: number }) => args.id > 0,
        }),
        title: f.field({
          type: t.String,
          // @ts-expect-error the context has no `role`
          authorize: (_parent, _args, ctx) => ctx.role === 'admin',
          resolve: () => '',
        }),
        authorId: f.field({
          type: t.String,
          // @ts-expect-error the merged option returns a string
          typedHint: () => 1,
        }),
      }),
    });
  });

  it('composes rules', () => {
    const loggedIn = (_parent: unknown, _args: unknown, ctx: Context) => ctx.userId != null;
    const isAdmin = async () => false;
    expectTypeOf(and(loggedIn, or(isAdmin, not(loggedIn)))).toEqualTypeOf<
      AuthRule<unknown, Context, unknown>
    >();
  });

  it('types inline rules inside composed rules with the field', () => {
    const loggedIn = (_parent: unknown, _args: unknown, ctx: Context) => ctx.userId != null;
    const t = initSchemaBuilder<{ context: Context }>();
    t.object(t.objectRef<PostModel>()('Post'), {
      authorize: or(
        loggedIn,
        not((post) => {
          expectTypeOf(post).toEqualTypeOf<PostModel>();
          return post.authorId === '';
        })
      ),
      fields: (f) => ({
        next: f.field({
          type: t.Int,
          args: { first: t.nonNull(t.Int) },
          authorize: and(loggedIn, (post, args, ctx) => {
            expectTypeOf(post).toEqualTypeOf<PostModel>();
            expectTypeOf(args).toEqualTypeOf<{ first: number }>();
            expectTypeOf(ctx).toEqualTypeOf<Context>();
            return args.first < 100;
          }),
          resolve: () => 1,
        }),
        other: f.field({
          type: t.Int,
          // @ts-expect-error the context has no `role`
          authorize: and(loggedIn, (_post, _args, ctx) => ctx.role === 'admin'),
          resolve: () => 1,
        }),
      }),
    });
  });

  it('accepts plugins typed with the builder context', () => {
    const plugin: SchemaPlugin<Context> = {
      name: 'context',
      wrapResolve: (next) => (source, args, ctx, info) => {
        expectTypeOf(ctx).toEqualTypeOf<Context>();
        return next(source, args, ctx, info);
      },
    };
    build([maskErrorsPlugin(), authPlugin(), plugin]);
    // @ts-expect-error the plugin expects a different context
    initSchemaBuilder<{ context: { other: true } }>({ plugins: [plugin] });
  });

  it("doesn't change the schema's type", () => {
    expectTypeOf<IntrospectionOf<ReturnType<typeof build>>>().toEqualTypeOf<
      IntrospectionOf<ReturnType<typeof buildWithoutPlugins>>
    >();
  });
});

const buildWithoutPlugins = () => {
  const t = initSchemaBuilder<{ context: Context }>();
  const Post = t.objectRef<PostModel>()('Post');
  const PostType = t.object(Post, {
    fields: (f) => ({ id: f.field({ type: t.nonNull(t.ID) }) }),
  });
  const Query = t.object(t.objectRef()('Query'), {
    fields: (f) => ({
      post: f.field({
        type: Post,
        args: { id: t.nonNull(t.ID), draft: t.Boolean },
        resolve: () => null,
      }),
    }),
  });
  return t.schema({ query: Query, types: [PostType] });
};
