import { describe, it, expect } from 'vitest';
import { graphql, subscribe, parse, GraphQLError } from 'graphql';

import type { AuthPluginOptions } from '../../../../examples/example-server/src/plugins/auth';
import { authPlugin, and, or, not } from '../../../../examples/example-server/src/plugins/auth';
import { maskErrorsPlugin } from '../../../../examples/example-server/src/plugins/maskErrors';
import { initSchemaBuilder } from '../builder';

interface Context {
  userId: string | null;
  role: 'admin' | 'member';
}

interface PostModel {
  id: string;
  authorId: string;
  draft: boolean;
}

const loggedIn = (_parent: unknown, _args: unknown, ctx: Context) => ctx.userId != null;
const admin = (_parent: unknown, _args: unknown, ctx: Context) => ctx.role === 'admin';

const createSchema = (options?: AuthPluginOptions, masked: unknown[] = []) => {
  const t = initSchemaBuilder<{ context: Context }>({
    plugins: [maskErrorsPlugin({ onError: (error) => masked.push(error) }), authPlugin(options)],
  });
  const Post = t.objectRef<PostModel>()('Post');
  const PostType = t.object(Post, {
    authorize: (post, _args, ctx) => !post.draft || post.authorId === ctx.userId,
    fields: (f) => ({
      id: f.field({ type: t.nonNull(t.ID), authorize: true }),
      authorId: f.field({ type: t.nonNull(t.ID) }),
      secret: f.field({ type: t.String, authorize: false, resolve: () => 'secret' }),
    }),
  });
  const posts: PostModel[] = [
    { id: 'p1', authorId: 'u1', draft: false },
    { id: 'p2', authorId: 'u1', draft: true },
  ];
  const Query = t.object(t.objectRef()('Query'), {
    fields: (f) => ({
      public: f.field({ type: t.String, authorize: true, resolve: () => 'hello' }),
      me: f.field({ type: t.ID, authorize: loggedIn, resolve: (_, _args, ctx) => ctx.userId }),
      posts: f.field({ type: t.nonNull(t.list(t.nonNull(Post))), resolve: () => posts }),
      post: f.field({
        type: Post,
        args: { id: t.nonNull(t.ID) },
        authorize: (_, args) => args.id !== 'forbidden',
        resolve: (_, args) => posts.find((post) => post.id === args.id),
      }),
      stats: f.field({
        type: t.Int,
        authorize: async (_, _args, ctx) => {
          await Promise.resolve();
          return ctx.role === 'admin' || new Error('Only admins may see stats.');
        },
        resolve: () => 42,
      }),
      either: f.field({
        type: t.Boolean,
        authorize: or(admin, not(loggedIn)),
        resolve: () => true,
      }),
      both: f.field({ type: t.Boolean, authorize: and(loggedIn, admin), resolve: () => true }),
      broken: f.field({
        type: t.String,
        authorize: true,
        resolve: () => {
          throw new Error('database password leaked');
        },
      }),
      unruled: f.field({ type: t.String, resolve: () => 'unruled' }),
    }),
  });
  const Mutation = t.object(t.objectRef()('Mutation'), {
    fields: (f) => ({
      deletePost: f.field({
        type: t.Boolean,
        args: { id: t.nonNull(t.ID) },
        authorize: and(loggedIn, admin),
        resolve: () => true,
      }),
    }),
  });
  const Subscription = t.object(t.objectRef()('Subscription'), {
    fields: (f) => ({
      ticks: f.field({
        type: t.Int,
        authorize: loggedIn,
        subscribe: async function* () {
          yield 1;
          yield 2;
        },
        resolve: (value) => value,
      }),
    }),
  });
  return t.schema({
    query: Query,
    mutation: Mutation,
    subscription: Subscription,
    types: [PostType],
  });
};

const member: Context = { userId: 'u2', role: 'member' };
const author: Context = { userId: 'u1', role: 'member' };
const anonymous: Context = { userId: null, role: 'member' };
const adminUser: Context = { userId: 'u3', role: 'admin' };

const run = (source: string, contextValue: Context, options?: AuthPluginOptions) =>
  graphql({ schema: createSchema(options), source, contextValue });

const messages = (result: { errors?: readonly GraphQLError[] }) =>
  (result.errors || []).map((error) => [error.message, error.path, error.extensions.code]);

describe('authPlugin', () => {
  it('allows and denies fields with sync, async, and composed rules', async () => {
    const result = await run(`{ public me stats either both }`, member);
    expect(result.data).toEqual({
      public: 'hello',
      me: 'u2',
      stats: null,
      either: null,
      both: null,
    });
    expect(messages(result)).toEqual([
      ['Not authorized to access "Query.either".', ['either'], 'FORBIDDEN'],
      ['Not authorized to access "Query.both".', ['both'], 'FORBIDDEN'],
      ['Only admins may see stats.', ['stats'], 'FORBIDDEN'],
    ]);
    expect((await run(`{ me either }`, anonymous)).data).toEqual({ me: null, either: true });
    expect((await run(`{ stats either both }`, adminUser)).data).toEqual({
      stats: 42,
      either: true,
      both: true,
    });
  });

  it('passes the parent, arguments, and context to rules', async () => {
    const result = await run(`{ post(id: "forbidden") { id } }`, member);
    expect(messages(result)).toEqual([
      ['Not authorized to access "Query.post".', ['post'], 'FORBIDDEN'],
    ]);
  });

  it('applies type rules to fields without their own rule, which replace it', async () => {
    const asMember = await run(`{ posts { id authorId } }`, member);
    expect(asMember.data).toEqual(null);
    expect(messages(asMember)).toEqual([
      ['Not authorized to access "Post.authorId".', ['posts', 1, 'authorId'], 'FORBIDDEN'],
    ]);
    const asAuthor = await run(`{ posts { id authorId secret } }`, author);
    expect(asAuthor.data).toEqual({
      posts: [
        { id: 'p1', authorId: 'u1', secret: null },
        { id: 'p2', authorId: 'u1', secret: null },
      ],
    });
    expect(messages(asAuthor).map(([message]) => message)).toEqual([
      'Not authorized to access "Post.secret".',
      'Not authorized to access "Post.secret".',
    ]);
  });

  it('applies the default policy to fields without rules', async () => {
    expect((await run(`{ unruled }`, member)).data).toEqual({ unruled: 'unruled' });
    const denied = await run(`{ unruled public }`, adminUser, { default: 'deny' });
    expect(denied.data).toEqual({ unruled: null, public: 'hello' });
    expect(messages(denied).map(([message]) => message)).toEqual([
      'Not authorized to access "Query.unruled".',
    ]);
  });

  it('checks mutations and uses custom errors', async () => {
    const createError = () => new GraphQLError('Nope', { extensions: { code: 'NOPE' } });
    const result = await run(`mutation { deletePost(id: "p1") }`, member, { createError });
    expect(messages(result)).toEqual([['Nope', ['deletePost'], 'NOPE']]);
    expect((await run(`mutation { deletePost(id: "p1") }`, adminUser)).data).toEqual({
      deletePost: true,
    });
  });

  it('checks subscriptions before they start', async () => {
    const schema = createSchema();
    const denied = await subscribe({
      schema,
      document: parse(`subscription { ticks }`),
      contextValue: anonymous,
    });
    expect(messages(denied as { errors?: readonly GraphQLError[] })).toEqual([
      ['Not authorized to access "Subscription.ticks".', ['ticks'], 'FORBIDDEN'],
    ]);
    const allowed = await subscribe({
      schema,
      document: parse(`subscription { ticks }`),
      contextValue: member,
    });
    const events: unknown[] = [];
    for await (const event of allowed as AsyncIterable<unknown>) events.push(event);
    expect(events).toEqual([{ data: { ticks: 1 } }, { data: { ticks: 2 } }]);
  });

  it('keeps authorization errors when errors are masked', async () => {
    const masked: unknown[] = [];
    const result = await graphql({
      schema: createSchema({}, masked),
      source: `{ broken both }`,
      contextValue: member,
    });
    expect(messages(result)).toEqual([
      ['Unexpected error.', ['broken'], 'INTERNAL_SERVER_ERROR'],
      ['Not authorized to access "Query.both".', ['both'], 'FORBIDDEN'],
    ]);
    expect(masked).toEqual([new Error('database password leaked')]);
  });

  it('rejects invalid rules', () => {
    const t = initSchemaBuilder({ plugins: [authPlugin()] });
    const Query = t.object(t.objectRef()('Query'), {
      fields: (f) => ({
        a: f.field({ type: t.Int, authorize: 'yes' as unknown as boolean, resolve: () => 1 }),
      }),
    });
    expect(() => t.schema({ query: Query })).toThrow(
      'The "authorize" option of "Query.a" must be a function or a boolean.'
    );
  });
});
