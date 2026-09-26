/* A schema that exercises every type system feature of the GraphQL specification (September 2025).
 * `kitchenSinkSDL` is the same schema written in SDL, which the tests compare the builder against.
 */
import { Kind } from 'graphql';
import { initSchemaBuilder } from '../../index';

export const kitchenSinkSDL = /* GraphQL */ `
  """
  Kitchen sink schema
  """
  schema {
    query: RootQuery
    mutation: RootMutation
    subscription: RootSubscription
  }

  """
  Traces an operation
  """
  directive @trace(
    label: String = "default"
  ) repeatable on QUERY | MUTATION | SUBSCRIPTION | FIELD | FRAGMENT_DEFINITION | FRAGMENT_SPREAD | INLINE_FRAGMENT | VARIABLE_DEFINITION

  """
  Attaches metadata to the type system
  """
  directive @meta(
    key: String!
    value: String
  ) repeatable on SCHEMA | SCALAR | OBJECT | FIELD_DEFINITION | ARGUMENT_DEFINITION | INTERFACE | UNION | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION

  """
  An ISO-8601 date-time
  """
  scalar DateTime @specifiedBy(url: "https://scalars.graphql.org/andimarek/date-time")

  scalar JSON

  """
  An object with a globally unique ID
  """
  interface Node {
    id: ID!
  }

  interface Entity implements Node {
    id: ID!
    createdAt: DateTime!
  }

  enum Role {
    """
    Administrator
    """
    ADMIN
    MEMBER
    GUEST @deprecated(reason: "Use MEMBER")
  }

  enum SortDirection {
    ASC
    DESC
  }

  enum UserOrderField {
    NAME
    CREATED_AT
  }

  input UserOrder {
    field: UserOrderField!
    direction: SortDirection = ASC
  }

  """
  Filters users
  """
  input UserFilter {
    name: String
    role: Role
    and: [UserFilter!]
    or: [UserFilter!]
    legacyName: String @deprecated(reason: "Use name")
  }

  input UserBy @oneOf {
    id: ID
    name: String
  }

  input CreatePostInput {
    title: String!
    authorId: ID!
    tags: [String!] = []
  }

  """
  A user
  """
  type User implements Node & Entity {
    id: ID!
    createdAt: DateTime!
    name: String!
    nickname: String @deprecated
    role: Role!
    friends(
      """
      Number of friends
      """
      first: Int = 10
      after: String
      orderBy: UserOrder = { field: NAME, direction: ASC }
      legacy: Boolean @deprecated(reason: "No longer supported")
    ): [User!]!
    matrix: [[Int!]]!
    posts: [Post!]
    meta: JSON
  }

  type Post implements Node & Entity {
    id: ID!
    createdAt: DateTime!
    title: String!
    tags: [String!]!
    author: User!
  }

  union SearchResult = User | Post

  type RootQuery {
    node(id: ID!): Node
    user(by: UserBy!): User
    users(filter: UserFilter, first: Int! = 20): [User!]!
    search(term: String!): [SearchResult!]!
    entities: [Entity!]!
    now: DateTime!
    echo(json: JSON): JSON
  }

  type RootMutation {
    createPost(input: CreatePostInput!): Post!
    deletePost(id: ID!): Boolean!
  }

  type RootSubscription {
    postCreated(authorId: ID): Post!
  }
`;

export interface UserModel {
  kind: 'user';
  id: string;
  name: string;
  nickname?: string | null;
  role: 'admin' | 'member' | 'guest';
  createdAt: Date;
  friendIds: string[];
}

export interface PostModel {
  kind: 'post';
  id: string;
  title: string;
  tags: string[];
  authorId: string;
  createdAt: Date;
}

export interface Context {
  users: UserModel[];
  posts: PostModel[];
  events: AsyncIterable<PostModel>;
  calls: { name: string; args: unknown }[];
}

const t = initSchemaBuilder<{ context: Context }>();

// References
export const Node = t.interfaceRef<UserModel | PostModel>()('Node');
export const Entity = t.interfaceRef<UserModel | PostModel>()('Entity');
export const User = t.objectRef<UserModel>()('User');
export const Post = t.objectRef<PostModel>()('Post');
interface UserFilterShape {
  name?: string | null;
  role?: 'admin' | 'member' | 'guest' | null;
  and?: UserFilterShape[] | null;
  or?: UserFilterShape[] | null;
  legacyName?: string | null;
}
const UserFilterRef = t.inputRef<UserFilterShape>()('UserFilter');
const RootQuery = t.objectRef()('RootQuery');
const RootMutation = t.objectRef()('RootMutation');
const RootSubscription = t.objectRef()('RootSubscription');

// Directives
export const Trace = t.directive('trace', {
  description: 'Traces an operation',
  isRepeatable: true,
  locations: [
    'QUERY',
    'MUTATION',
    'SUBSCRIPTION',
    'FIELD',
    'FRAGMENT_DEFINITION',
    'FRAGMENT_SPREAD',
    'INLINE_FRAGMENT',
    'VARIABLE_DEFINITION',
  ],
  args: { label: { type: t.String, defaultValue: 'default' } },
});

export const Meta = t.directive('meta', {
  description: 'Attaches metadata to the type system',
  isRepeatable: true,
  locations: [
    'SCHEMA',
    'SCALAR',
    'OBJECT',
    'FIELD_DEFINITION',
    'ARGUMENT_DEFINITION',
    'INTERFACE',
    'UNION',
    'ENUM',
    'ENUM_VALUE',
    'INPUT_OBJECT',
    'INPUT_FIELD_DEFINITION',
  ],
  args: { key: t.nonNull(t.String), value: t.String },
});

// Scalars
export const DateTime = t.scalar('DateTime', {
  description: 'An ISO-8601 date-time',
  specifiedByURL: 'https://scalars.graphql.org/andimarek/date-time',
  serialize: (value: Date) => value.toISOString(),
  parseValue: (value) => new Date(value as string),
  parseLiteral: (ast) => new Date(ast.kind === Kind.STRING ? ast.value : NaN),
});

// Scalar extension, only adding a directive
const DateTimeExtension = t.scalar(DateTime, {
  directives: [t.apply(Meta, { key: 'format', value: 'iso-8601' })],
});

export const JSONScalar = t.scalar('JSON', {
  serialize: (value: unknown) => value as unknown,
  parseValue: (value) => value,
});

// Enums
export const RoleRef = t.enumRef<'admin' | 'member' | 'guest'>()('Role');

export const Role = t.enum(RoleRef, {
  values: {
    ADMIN: { value: 'admin', description: 'Administrator' },
    MEMBER: { value: 'member' },
  },
});

// Enum extension, adding a value
const RoleExtension = t.enum(RoleRef, {
  values: {
    GUEST: {
      value: 'guest',
      deprecationReason: 'Use MEMBER',
      directives: [t.apply(Meta, { key: 'since', value: '2025' })],
    },
  },
});

const SortDirection = t.enum('SortDirection', { values: ['ASC', 'DESC'] });
const UserOrderField = t.enum('UserOrderField', {
  values: { NAME: { value: 'name' }, CREATED_AT: { value: 'createdAt' } },
});

// Input objects
const UserOrder = t.input('UserOrder', {
  fields: {
    field: t.nonNull(UserOrderField),
    direction: { type: SortDirection, defaultValue: 'ASC' },
  },
});

const UserFilter = t.input(UserFilterRef, {
  description: 'Filters users',
  fields: {
    name: t.String,
    role: Role,
    and: t.list(t.nonNull(UserFilterRef)),
    or: t.list(t.nonNull(UserFilterRef)),
  },
});

// Input object extension, adding a field
const UserFilterExtension = t.input(UserFilterRef, {
  fields: { legacyName: { type: t.String, deprecationReason: 'Use name' } },
});

export const UserBy = t.input('UserBy', {
  isOneOf: true,
  fields: { id: t.ID, name: t.String },
});

const CreatePostInput = t.input('CreatePostInput', {
  fields: () => ({
    title: t.nonNull(t.String),
    authorId: t.nonNull(t.ID),
    tags: { type: t.list(t.nonNull(t.String)), defaultValue: [] },
  }),
});

// Interfaces
const NodeType = t.interface(Node, {
  description: 'An object with a globally unique ID',
  resolveType: (value) => (value.kind === 'user' ? 'User' : 'Post'),
  fields: (f) => ({ id: f.field({ type: t.nonNull(t.ID) }) }),
});

const EntityType = t.interface(Entity, {
  interfaces: [Node],
  fields: (f) => ({
    id: f.field({ type: t.nonNull(t.ID) }),
    createdAt: f.field({ type: t.nonNull(DateTime) }),
  }),
});

// Objects
const UserType = t.object(User, {
  description: 'A user',
  interfaces: [Node, Entity],
  isTypeOf: (value) => (value as UserModel).kind === 'user',
  directives: [t.apply(Meta, { key: 'owner', value: 'accounts' })],
  fields: (f) => ({
    id: f.field({ type: t.nonNull(t.ID) }),
    createdAt: f.field({ type: t.nonNull(DateTime) }),
    name: f.field({ type: t.nonNull(t.String) }),
    nickname: f.field({ type: t.String, deprecationReason: 'No longer supported' }),
    role: f.field({ type: t.nonNull(Role) }),
    friends: f.field({
      type: t.nonNull(t.list(t.nonNull(User))),
      args: {
        first: { type: t.Int, defaultValue: 10, description: 'Number of friends' },
        after: t.String,
        orderBy: { type: UserOrder, defaultValue: { field: 'name', direction: 'ASC' } },
        legacy: {
          type: t.Boolean,
          deprecationReason: 'No longer supported',
          directives: [t.apply(Meta, { key: 'legacy' })],
        },
      },
      resolve(user, args, ctx) {
        ctx.calls.push({ name: 'User.friends', args });
        return ctx.users
          .filter((friend) => user.friendIds.includes(friend.id))
          .slice(0, args.first ?? undefined);
      },
    }),
  }),
});

// Object extension, adding fields
const UserTypeExtension = t.object(User, {
  fields: (f) => ({
    matrix: f.field({
      type: t.nonNull(t.list(t.list(t.nonNull(t.Int)))),
      resolve: () => [[1, 2], null, [3]],
    }),
    posts: f.field({
      type: t.list(t.nonNull(Post)),
      directives: [t.apply(Meta, { key: 'a' }), t.apply(Meta, { key: 'b' })],
      resolve: (user, _args, ctx) => ctx.posts.filter((post) => post.authorId === user.id),
    }),
    meta: f.field({ type: JSONScalar, resolve: (user) => ({ id: user.id }) }),
  }),
});

const PostType = t.object(Post, {
  interfaces: [Node, Entity],
  isTypeOf: (value) => (value as PostModel).kind === 'post',
  fields: (f) => ({
    id: f.field({ type: t.nonNull(t.ID) }),
    createdAt: f.field({ type: t.nonNull(DateTime) }),
    title: f.field({ type: t.nonNull(t.String) }),
    tags: f.field({ type: t.nonNull(t.list(t.nonNull(t.String))) }),
    author: f.field({
      type: t.nonNull(User),
      resolve: (post, _args, ctx) => ctx.users.find((user) => user.id === post.authorId)!,
    }),
  }),
});

// Unions
export const SearchResultRef = t.unionRef<UserModel | PostModel>()('SearchResult');

export const SearchResult = t.union(SearchResultRef, {
  types: [User],
  resolveType: (value) => (value.kind === 'user' ? 'User' : 'Post'),
  directives: [t.apply(Meta, { key: 'search' })],
});

// Union extension, adding a member
const SearchResultExtension = t.union(SearchResultRef, {
  types: [Post],
});

// Root types
const Query = t.object(RootQuery, {
  fields: (f) => ({
    node: f.field({
      type: Node,
      args: { id: t.nonNull(t.ID) },
      resolve: (_, { id }, ctx) =>
        ctx.users.find((user) => user.id === id) || ctx.posts.find((post) => post.id === id),
    }),
    user: f.field({
      type: User,
      args: { by: t.nonNull(UserBy) },
      resolve: (_, { by }, ctx) =>
        'id' in by
          ? ctx.users.find((user) => user.id === by.id)
          : ctx.users.find((user) => user.name === by.name),
    }),
    users: f.field({
      type: t.nonNull(t.list(t.nonNull(User))),
      args: { filter: UserFilter, first: { type: t.nonNull(t.Int), defaultValue: 20 } },
      resolve(_, args, ctx) {
        ctx.calls.push({ name: 'RootQuery.users', args });
        const matches = (user: UserModel, filter: UserFilterShape): boolean =>
          (filter.name == null || user.name === filter.name) &&
          (filter.role == null || user.role === filter.role) &&
          (filter.and || []).every((inner) => matches(user, inner)) &&
          (!filter.or || filter.or.some((inner) => matches(user, inner)));
        return ctx.users
          .filter((user) => !args.filter || matches(user, args.filter))
          .slice(0, args.first);
      },
    }),
  }),
});

// Root type extension, e.g. from another module
const QueryExtension = t.object(RootQuery, {
  fields: (f) => ({
    search: f.field({
      type: t.nonNull(t.list(t.nonNull(SearchResult))),
      args: { term: t.nonNull(t.String) },
      resolve: (_, { term }, ctx) => [
        ...ctx.users.filter((user) => user.name.includes(term)),
        ...ctx.posts.filter((post) => post.title.includes(term)),
      ],
    }),
    entities: f.field({
      type: t.nonNull(t.list(t.nonNull(Entity))),
      resolve: (_, _args, ctx) => [...ctx.users, ...ctx.posts],
    }),
    now: f.field({
      type: t.nonNull(DateTime),
      resolve: () => new Date('2025-09-03T00:00:00.000Z'),
    }),
    echo: f.field({
      type: JSONScalar,
      args: { json: JSONScalar },
      resolve: (_, args) => args.json,
    }),
  }),
});

const Mutation = t.object(RootMutation, {
  fields: (f) => ({
    createPost: f.field({
      type: t.nonNull(Post),
      args: { input: t.nonNull(CreatePostInput) },
      resolve(_, { input }, ctx) {
        const post: PostModel = {
          kind: 'post',
          id: `p${ctx.posts.length + 1}`,
          title: input.title,
          tags: input.tags || [],
          authorId: `${input.authorId}`,
          createdAt: new Date('2025-09-03T00:00:00.000Z'),
        };
        ctx.posts.push(post);
        return post;
      },
    }),
    deletePost: f.field({
      type: t.nonNull(t.Boolean),
      args: { id: t.nonNull(t.ID) },
      resolve(_, { id }, ctx) {
        const index = ctx.posts.findIndex((post) => post.id === id);
        if (index > -1) ctx.posts.splice(index, 1);
        return index > -1;
      },
    }),
  }),
});

const Subscription = t.object(RootSubscription, {
  fields: (f) => ({
    postCreated: f.field({
      type: t.nonNull(Post),
      args: { authorId: t.ID },
      subscribe: (_, _args, ctx) => ctx.events,
      resolve: (payload, args) =>
        args.authorId == null || payload.authorId === args.authorId
          ? payload
          : { ...payload, title: `(filtered) ${payload.title}` },
    }),
  }),
});

export const schema = t.schema({
  description: 'Kitchen sink schema',
  query: Query,
  mutation: Mutation,
  subscription: Subscription,
  directives: [Trace, Meta],
  schemaDirectives: [t.apply(Meta, { key: 'schema' })],
  types: [
    QueryExtension,
    DateTime,
    DateTimeExtension,
    JSONScalar,
    Role,
    RoleExtension,
    SortDirection,
    UserOrderField,
    UserOrder,
    UserFilter,
    UserFilterExtension,
    UserBy,
    CreatePostInput,
    NodeType,
    EntityType,
    UserType,
    UserTypeExtension,
    PostType,
    SearchResult,
    SearchResultExtension,
  ],
});

export const createContext = (
  events: AsyncIterable<PostModel> = (async function* () {})()
): Context => ({
  users: [
    {
      kind: 'user',
      id: 'u1',
      name: 'Phil',
      role: 'admin',
      createdAt: new Date('2024-01-16T00:00:00.000Z'),
      friendIds: ['u2', 'u3'],
    },
    {
      kind: 'user',
      id: 'u2',
      name: 'Jovi',
      nickname: 'jd',
      role: 'member',
      createdAt: new Date('2024-03-01T00:00:00.000Z'),
      friendIds: ['u1'],
    },
    {
      kind: 'user',
      id: 'u3',
      name: 'Guest',
      role: 'guest',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      friendIds: [],
    },
  ],
  posts: [
    {
      kind: 'post',
      id: 'p1',
      title: 'Hello tada',
      tags: ['intro'],
      authorId: 'u1',
      createdAt: new Date('2024-02-01T00:00:00.000Z'),
    },
  ],
  events,
  calls: [],
});
