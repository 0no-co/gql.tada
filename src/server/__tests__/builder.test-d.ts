import { describe, it, expectTypeOf } from 'vitest';

import type { ResultOf, VariablesOf } from '../../api';
import { initGraphQLTada } from '../../api';
import type { IntrospectionOf } from '../contract';
import { initSchemaBuilder } from '../builder';
import type { NamedRef } from '../refs';

import type { schema, UserModel, PostModel, Context } from './fixtures/kitchenSink';
import type { kitchenSinkIntrospection } from './fixtures/kitchenSinkIntrospection';

type derived = IntrospectionOf<typeof schema>;

/** Typed with the schema derived by the builder */
const graphql = initGraphQLTada<{ introspection: derived }>();

/** Typed with the same schema, generated from SDL like `gql.tada generate output` */
const sdlGraphql = initGraphQLTada<{
  introspection: kitchenSinkIntrospection;
  scalars: { DateTime: string; JSON: unknown };
}>();

describe('derived schema type', () => {
  it('derives root operation types', () => {
    expectTypeOf<derived['query']>().toEqualTypeOf<'RootQuery'>();
    expectTypeOf<derived['mutation']>().toEqualTypeOf<'RootMutation'>();
    expectTypeOf<derived['subscription']>().toEqualTypeOf<'RootSubscription'>();
  });

  it('merges type extensions', () => {
    expectTypeOf<keyof derived['types']['User']['fields']>().toEqualTypeOf<
      'id' | 'createdAt' | 'name' | 'nickname' | 'role' | 'friends' | 'matrix' | 'posts' | 'meta'
    >();
    expectTypeOf<keyof derived['types']['RootQuery']['fields']>().toEqualTypeOf<
      'node' | 'user' | 'users' | 'search' | 'entities' | 'now' | 'echo'
    >();
    expectTypeOf<derived['types']['Role']['enumValues']>().toEqualTypeOf<
      'ADMIN' | 'MEMBER' | 'GUEST'
    >();
    expectTypeOf<derived['types']['SearchResult']['possibleTypes']>().toEqualTypeOf<
      'User' | 'Post'
    >();
    expectTypeOf<keyof derived['types']['UserFilter']['inputFields']>().toEqualTypeOf<
      'name' | 'role' | 'and' | 'or' | 'legacyName'
    >();
  });

  it('derives possible types of interfaces', () => {
    expectTypeOf<derived['types']['Node']['possibleTypes']>().toEqualTypeOf<'User' | 'Post'>();
    expectTypeOf<derived['types']['Entity']['possibleTypes']>().toEqualTypeOf<'User' | 'Post'>();
  });

  it('derives scalars as their serialized type', () => {
    expectTypeOf<derived['types']['DateTime']['type']>().toEqualTypeOf<string>();
    expectTypeOf<derived['types']['JSON']['type']>().toEqualTypeOf<unknown>();
  });

  it('derives OneOf Input Objects', () => {
    expectTypeOf<derived['types']['UserBy']['isOneOf']>().toEqualTypeOf<true>();
    expectTypeOf<derived['types']['UserFilter']['isOneOf']>().toEqualTypeOf<false>();
  });
});

describe('documents typed with the derived schema', () => {
  it('types object fields, enums, scalars, lists, and deprecated fields like the SDL schema', () => {
    const document = `
      query ($by: UserBy!, $first: Int, $order: UserOrder) {
        user(by: $by) {
          id
          name
          nickname
          role
          createdAt
          matrix
          meta
          friends(first: $first, orderBy: $order) { id name }
          posts { title tags author { name } }
        }
      }
    ` as const;

    const query = graphql(document);
    const sdlQuery = sdlGraphql(document);

    expectTypeOf<ResultOf<typeof query>>().toEqualTypeOf<ResultOf<typeof sdlQuery>>();
    expectTypeOf<VariablesOf<typeof query>>().toEqualTypeOf<VariablesOf<typeof sdlQuery>>();
    expectTypeOf<ResultOf<typeof query>>().toEqualTypeOf<{
      user: {
        id: string;
        name: string;
        nickname: string | null;
        role: 'ADMIN' | 'MEMBER' | 'GUEST';
        createdAt: string;
        matrix: (number[] | null)[];
        meta: unknown;
        friends: { id: string; name: string }[];
        posts: { title: string; tags: string[]; author: { name: string } }[] | null;
      } | null;
    }>();
    expectTypeOf<VariablesOf<typeof query>>().toEqualTypeOf<{
      by: { id: string } | { name: string };
      first?: number | null;
      order?: {
        field: 'NAME' | 'CREATED_AT';
        direction?: 'ASC' | 'DESC' | null;
      } | null;
    }>();
  });

  it('types interfaces and unions like the SDL schema', () => {
    const document = `
      query ($id: ID!, $term: String!) {
        node(id: $id) { __typename id ... on Post { title } }
        entities { __typename createdAt ... on User { name } }
        search(term: $term) {
          __typename
          ... on User { name }
          ... on Post { title }
        }
      }
    ` as const;

    const query = graphql(document);
    const sdlQuery = sdlGraphql(document);

    expectTypeOf<ResultOf<typeof query>>().toEqualTypeOf<ResultOf<typeof sdlQuery>>();
    expectTypeOf<ResultOf<typeof query>['search'][number]>().toEqualTypeOf<
      { __typename: 'User'; name: string } | { __typename: 'Post'; title: string }
    >();
  });

  it('types recursive input objects like the SDL schema', () => {
    const document = `
      query ($filter: UserFilter) { users(filter: $filter) { id } }
    ` as const;

    const query = graphql(document);
    const sdlQuery = sdlGraphql(document);

    expectTypeOf<VariablesOf<typeof query>>().toEqualTypeOf<VariablesOf<typeof sdlQuery>>();
  });

  it('types mutations with defaulted input fields like the SDL schema', () => {
    const document = `
      mutation ($input: CreatePostInput!) { createPost(input: $input) { id tags } }
    ` as const;

    const mutation = graphql(document);
    const sdlMutation = sdlGraphql(document);

    expectTypeOf<ResultOf<typeof mutation>>().toEqualTypeOf<ResultOf<typeof sdlMutation>>();
    expectTypeOf<VariablesOf<typeof mutation>>().toEqualTypeOf<VariablesOf<typeof sdlMutation>>();
    expectTypeOf<VariablesOf<typeof mutation>>().toEqualTypeOf<{
      input: { title: string; authorId: string; tags?: string[] | null };
    }>();
  });

  it('types subscriptions like the SDL schema', () => {
    const document = `subscription { postCreated { id author { name } } }` as const;
    const subscription = graphql(document);
    const sdlSubscription = sdlGraphql(document);
    expectTypeOf<ResultOf<typeof subscription>>().toEqualTypeOf<ResultOf<typeof sdlSubscription>>();
  });

  it('types scalar and enum values', () => {
    expectTypeOf(graphql.scalar('Role', 'ADMIN')).toEqualTypeOf<'ADMIN'>();
    const date: string = new Date().toISOString();
    expectTypeOf(graphql.scalar('DateTime', date)).toEqualTypeOf<string>();
  });
});

describe('resolver types', () => {
  const t = initSchemaBuilder<{ context: Context }>();
  const User = t.objectRef<UserModel>()('User');
  const Post = t.objectRef<PostModel>()('Post');
  const Role = t.enum('Role', { values: { ADMIN: { value: 'admin' }, MEMBER: {} } });
  const DateTime = t.scalar('DateTime', { serialize: (value: Date) => value.toISOString() });
  const Filter = t.input('Filter', {
    fields: { role: t.nonNull(Role), limit: { type: t.Int, defaultValue: 10 }, after: t.ID },
  });
  const OneOf = t.input('OneOf', { isOneOf: true, fields: { id: t.ID, name: t.String } });

  it('types parents, arguments, context, and results', () => {
    t.object(User, {
      fields: (f) => ({
        id: f.field({ type: t.nonNull(t.ID) }),
        posts: f.field({
          type: t.nonNull(t.list(t.nonNull(Post))),
          args: {
            filter: t.nonNull(Filter),
            by: OneOf,
            first: { type: t.nonNull(t.Int), defaultValue: 1 },
            last: t.Int,
          },
          resolve(parent, args, context) {
            expectTypeOf(parent).toEqualTypeOf<UserModel>();
            expectTypeOf(context).toEqualTypeOf<Context>();
            expectTypeOf(args).toEqualTypeOf<{
              filter: { role: 'admin' | 'MEMBER'; limit: number | null; after?: string | null };
              by?: { id: string } | { name: string } | null;
              first: number;
              last?: number | null;
            }>();
            return context.posts;
          },
        }),
        joined: f.field({
          type: DateTime,
          resolve: (parent) => {
            expectTypeOf<ReturnType<typeof parent.createdAt.toISOString>>().toEqualTypeOf<string>();
            return parent.createdAt;
          },
        }),
      }),
    });
  });

  it('types subscription payloads', () => {
    t.object(t.objectRef()('Subscription'), {
      fields: (f) => ({
        counter: f.field({
          type: t.nonNull(t.Int),
          async *subscribe() {
            yield { count: 1 };
          },
          resolve(payload) {
            expectTypeOf(payload).toEqualTypeOf<{ count: number }>();
            return payload.count;
          },
        }),
      }),
    });
  });

  it('rejects invalid resolvers', () => {
    t.object(User, {
      fields: (f) => ({
        // @ts-expect-error: must return a string
        name: f.field({ type: t.nonNull(t.String), resolve: (user) => user.createdAt }),
        friends: f.field({
          type: t.list(User),
          args: { first: t.Int },
          // @ts-expect-error: unknown argument
          resolve: (_, args) => (args.frist ? [] : null),
        }),
      }),
    });
  });

  it('checks fields without resolvers against the backing type', () => {
    t.object(User, {
      fields: (f) => ({ name: f.field({ type: t.nonNull(t.String) }) }),
    });
    // @ts-expect-error: `email` isn't a property of `UserModel`
    t.object(User, { fields: (f) => ({ email: f.field({ type: t.String }) }) });
    // @ts-expect-error: `nickname` may be null, but the field is non-null
    t.object(User, { fields: (f) => ({ nickname: f.field({ type: t.nonNull(t.String) }) }) });
  });

  it('rejects invalid input and output types', () => {
    t.object(User, {
      fields: (f) => ({
        // @ts-expect-error: input objects aren't output types
        filter: f.field({ type: Filter, resolve: () => null }),
        // @ts-expect-error: object types aren't input types
        posts: f.field({ type: t.String, args: { post: Post }, resolve: () => null }),
      }),
    });
    // @ts-expect-error: Non-Null types may not wrap Non-Null types
    t.nonNull(t.nonNull(t.String));
  });

  it('checks default values against their types', () => {
    t.input('Defaults', {
      fields: { ok: { type: t.list(t.nonNull(t.String)), defaultValue: ['a'] } },
    });
    // @ts-expect-error: must be an Int
    t.input('Defaults', { fields: { bad: { type: t.Int, defaultValue: 'ten' } } });
  });

  it('checks union resolveType results', () => {
    t.union('Search', {
      types: [User, Post],
      resolveType: (value) => ('title' in value ? 'Post' : 'User'),
    });
    // @ts-expect-error: not a member of the union
    t.union('Search', { types: [User, Post], resolveType: () => 'Comment' });
  });

  it('checks directive locations and arguments', () => {
    const Tag = t.directive('tag', {
      locations: ['FIELD_DEFINITION', 'OBJECT'],
      args: { name: t.nonNull(t.String), weight: { type: t.Int, defaultValue: 1 } },
    });
    t.object(User, { directives: [t.apply(Tag, { name: 'user' })] });
    // @ts-expect-error: not allowed on ENUM
    t.enum('Tagged', { values: ['A'], directives: [t.apply(Tag, { name: 'enum' })] });
    // @ts-expect-error: missing required argument
    t.apply(Tag);
    // @ts-expect-error: unknown argument
    t.apply(Tag, { name: 'x', color: 'red' });
  });

  it('checks that referenced types are passed to the schema', () => {
    const Query = t.object(t.objectRef()('Query'), {
      fields: (f) => ({ role: f.field({ type: Role, resolve: () => 'admin' as const }) }),
    });
    t.schema({ query: Query, types: [Role] });
    // @ts-expect-error: `Role` is missing from `types`
    t.schema({ query: Query, types: [] });
  });
});

describe('references with explicit types', () => {
  const t = initSchemaBuilder();
  const Query = t.objectRef<{}>()('Query');

  it('checks enum values against their reference', () => {
    const Role = t.enumRef<'admin' | 'member'>()('Role');
    t.enum(Role, { values: { ADMIN: { value: 'admin' }, MEMBER: { value: 'member' } } });
    // @ts-expect-error: internal values are 'admin' | 'member', not the value names
    t.enum(Role, { values: ['ADMIN', 'MEMBER'] });
  });

  it('checks input fields against their reference', () => {
    const Filter = t.inputRef<{ name?: string | null; limit: number }>()('Filter');
    t.input(Filter, { fields: { name: t.String, limit: t.nonNull(t.Int) } });
    // @ts-expect-error: `other` isn't a field of the reference's type
    t.input(Filter, { fields: { other: t.String } });
    // @ts-expect-error: `limit` may be null here, but is required by the reference's type
    t.input(Filter, { fields: { limit: t.Int } });
  });

  it('requires all values and required fields of a reference to be defined', () => {
    const Role = t.enumRef<'admin' | 'member'>()('Role');
    const Filter = t.inputRef<{ name?: string | null; limit: number }>()('Filter');
    const Admin = t.enum(Role, { values: { ADMIN: { value: 'admin' } } });
    const Member = t.enum(Role, { values: { MEMBER: { value: 'member' } } });
    const Name = t.input(Filter, { fields: { name: t.String } });
    const Limit = t.input(Filter, { fields: { limit: t.nonNull(t.Int) } });
    const query = t.object(Query, {
      fields: (f) => ({
        role: f.field({ type: Role, args: { filter: Filter }, resolve: () => 'admin' as const }),
      }),
    });
    t.schema({ query, types: [Admin, Member, Name, Limit] });
    // @ts-expect-error: the 'member' value and `limit` field are never defined
    t.schema({ query, types: [Admin, Name] });
  });

  it('accepts OneOf Input Objects declared with union or optional shapes', () => {
    const By = t.inputRef<{ id: string } | { name: string }>()('By');
    t.input(By, { isOneOf: true, fields: { id: t.ID, name: t.String } });
    const Optional = t.inputRef<{ id?: string; name?: string }>()('Optional');
    t.input(Optional, { isOneOf: true, fields: { id: t.ID, name: t.String } });
    // @ts-expect-error: `other` isn't part of the reference's type
    t.input(By, { isOneOf: true, fields: { id: t.ID, other: t.String } });
  });

  it("doesn't require completeness of references without explicit types", () => {
    const Color = t.enumRef()('Color');
    const Red = t.enum(Color, { values: ['RED'] });
    const query = t.object(Query, {
      fields: (f) => ({ color: f.field({ type: Color, resolve: () => 'RED' }) }),
    });
    t.schema({ query, types: [Red] });
  });

  it('only extends types defined from references', () => {
    const Status = t.enum('Status', { values: ['A', 'B'] });
    // @ts-expect-error: extending a definition would change its type after it's been used
    t.enum(Status, { values: ['C'] });
    const Input = t.input('Input', { fields: { a: t.String } });
    // @ts-expect-error: see above
    t.input(Input, { fields: { b: t.String } });
    const A = t.objectRef<{ a: 1 }>()('A');
    const Union = t.union('Union', { types: [A] });
    // @ts-expect-error: see above
    t.union(Union, { types: [A] });
  });
});

describe('builder soundness', () => {
  const t = initSchemaBuilder();

  it('types scalar inputs as `parseValue` returns them', () => {
    const Raw = t.scalar('Raw', { serialize: (value: Date) => value.toISOString() });
    const Parsed = t.scalar('Parsed', {
      serialize: (value: Date) => value.toISOString(),
      parseValue: (value) => new Date(value as string),
    });
    t.object(t.objectRef()('Query'), {
      fields: (f) => ({
        field: f.field({
          type: t.String,
          args: { raw: t.nonNull(Raw), parsed: t.nonNull(Parsed) },
          resolve(_, args) {
            // Without `parseValue`, graphql-js passes input values as-is
            expectTypeOf(args.raw).toEqualTypeOf<unknown>();
            expectTypeOf(args.parsed).toEqualTypeOf<Date>();
            return null;
          },
        }),
      }),
    });
  });

  it('requires resolvers for fields of types without a backing type', () => {
    // @ts-expect-error: the parent value is `unknown`, so `hello` needs a resolver
    t.object(t.objectRef()('Query'), { fields: (f) => ({ hello: f.field({ type: t.String }) }) });
    // Opting out explicitly with `any` is allowed
    t.object(t.objectRef<any>()('Query'), {
      fields: (f) => ({ hello: f.field({ type: t.String }) }),
    });
  });

  it('checks methods that the default resolver calls', () => {
    class Greeter {
      hello() {
        return 'hello';
      }
      greet(args: { name?: string | null }) {
        return `hello ${args.name}`;
      }
      shout(prefix: string) {
        return prefix.toUpperCase();
      }
    }
    const Ref = t.objectRef<Greeter>()('Greeter');
    t.object(Ref, {
      fields: (f) => ({
        hello: f.field({ type: t.String }),
        greet: f.field({ type: t.String, args: { name: t.String } }),
      }),
    });
    // @ts-expect-error: graphql-js calls `shout(args, context, info)`
    t.object(Ref, { fields: (f) => ({ shout: f.field({ type: t.String }) }) });
  });

  it('accepts iterables, but not strings, for lists', () => {
    t.object(t.objectRef()('Query'), {
      fields: (f) => ({
        set: f.field({ type: t.list(t.String), resolve: () => new Set(['a']) }),
        // @ts-expect-error: strings aren't lists
        string: f.field({ type: t.list(t.String), resolve: () => 'abc' }),
      }),
    });
  });

  it('requires literal type names in schemas', () => {
    const query = t.object(t.objectRef()('Query'), {
      fields: (f) => ({ hello: f.field({ type: t.String, resolve: () => 'world' }) }),
    });
    const name: string = 'Wrapper';
    const Wrapper = t.enum(name, { values: ['A'] });
    // @ts-expect-error: the schema type can only be derived from literal names
    t.schema({ query, types: [Wrapper] });
  });

  it('supports generic helpers that create types', () => {
    // e.g. a helper creating connection types
    function connection<Name extends string, Node extends NamedRef<'OBJECT'>>(
      name: Name,
      node: Node
    ) {
      const Connection = t.objectRef<{ nodes: NonNullable<Node['~shape']>[] }>()(
        `${name}Connection`
      );
      return t.object(Connection, {
        fields: (f) => ({ nodes: f.field({ type: t.nonNull(t.list(t.nonNull(node))) }) }),
      });
    }

    const User = t.objectRef<{ id: string }>()('User');
    const UserType = t.object(User, { fields: (f) => ({ id: f.field({ type: t.ID }) }) });
    const UserConnection = connection('User', User);
    const Letter = t.enumRef<'a' | 'b'>()('Letter');
    const LetterA = t.enum(Letter, { values: { A: { value: 'a' } } });
    const query = t.object(t.objectRef()('Query'), {
      fields: (f) => ({
        users: f.field({
          type: t.objectRef<{ nodes: { id: string }[] }>()('UserConnection'),
          resolve: () => ({ nodes: [] }),
        }),
        letter: f.field({ type: Letter, resolve: () => 'a' as const }),
      }),
    });
    const schema = t.schema({
      query,
      types: [UserType, UserConnection, LetterA, t.enum(Letter, { values: { B: { value: 'b' } } })],
    });
    expectTypeOf<keyof IntrospectionOf<typeof schema>['types']>().toEqualTypeOf<
      'Query' | 'User' | 'UserConnection' | 'Letter'
    >();
  });

  it('rejects unknown schema options', () => {
    const query = t.object(t.objectRef()('Query'), {
      fields: (f) => ({ hello: f.field({ type: t.String, resolve: () => 'world' }) }),
    });
    const mutation = t.object(t.objectRef()('Mutation'), {
      fields: (f) => ({ hello: f.field({ type: t.String, resolve: () => 'world' }) }),
    });
    // @ts-expect-error: typo of `mutation`
    t.schema({ query, mutaton: mutation });
  });

  it('checks scalar default values against the internal type', () => {
    const DateTime = t.scalar('DateTime', { serialize: (value: Date) => value.toISOString() });
    t.input('Range', { fields: { from: { type: DateTime, defaultValue: new Date(0) } } });
    // @ts-expect-error: graphql-js serializes default values, which must be internal values
    t.input('Range', { fields: { from: { type: DateTime, defaultValue: '1970-01-01' } } });
  });

  it('requires parseValue when parseLiteral is set', () => {
    t.scalar('Date', {
      serialize: (value: Date) => value.toISOString(),
      parseValue: (value) => new Date(value as string),
      parseLiteral: () => new Date(0),
    });
    // @ts-expect-error: graphql-js requires both
    t.scalar('Date', {
      serialize: (value: Date) => value.toISOString(),
      parseLiteral: () => new Date(0),
    });
  });

  it('checks the context parameter of methods the default resolver calls', () => {
    const t = initSchemaBuilder<{ context: { userId: string } }>();
    class User {
      posts(_args: {}, context: { userId: string }) {
        return context.userId ? 1 : 0;
      }
      count(_args: {}, context: { db: { count(): number } }) {
        return context.db.count();
      }
    }
    const Ref = t.objectRef<User>()('User');
    t.object(Ref, { fields: (f) => ({ posts: f.field({ type: t.Int }) }) });
    // @ts-expect-error: the context doesn't have `db`
    t.object(Ref, { fields: (f) => ({ count: f.field({ type: t.Int }) }) });
  });

  it('names schemas for multi-schema setups', () => {
    const query = t.object(t.objectRef()('Query'), {
      fields: (f) => ({ hello: f.field({ type: t.String, resolve: () => 'world' }) }),
    });
    const schema = t.schema({ name: 'admin', query });
    expectTypeOf<IntrospectionOf<typeof schema>['name']>().toEqualTypeOf<'admin'>();
    const admin = initGraphQLTada<{ introspection: IntrospectionOf<typeof schema> }>();
    expectTypeOf(admin.__name).toEqualTypeOf<'admin'>();
  });
});
