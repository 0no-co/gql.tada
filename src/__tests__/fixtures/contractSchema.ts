import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLScalarType,
  GraphQLNonNull,
  GraphQLList,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
} from 'graphql';

import type {
  TadaSchema,
  TadaSchemaCarrier,
  TadaNamedTypeRef,
  TadaNonNullTypeRef,
  TadaListTypeRef,
  TadaObjectType,
  TadaInterfaceType,
  TadaUnionType,
  TadaEnumType,
  TadaScalarType,
  TadaInputObjectType,
} from '../../contract';

// A graphql-js schema, with its contract type written by hand next to it

const DateTime = new GraphQLScalarType<Date, string>({
  name: 'DateTime',
  serialize: (value) => (value as Date).toISOString(),
  parseValue: (value) => new Date(value as string),
});

const Status = new GraphQLEnumType({
  name: 'Status',
  values: { OPEN: {}, IN_PROGRESS: {}, CLOSED: {} },
});

const Priority = new GraphQLEnumType({
  name: 'Priority',
  values: { LOW: {}, MEDIUM: {}, HIGH: {} },
});

const Node = new GraphQLInterfaceType({
  name: 'Node',
  fields: { id: { type: new GraphQLNonNull(GraphQLID) } },
});

const Actor = new GraphQLInterfaceType({
  name: 'Actor',
  interfaces: [Node],
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    login: { type: new GraphQLNonNull(GraphQLString) },
    avatarUrl: { type: GraphQLString },
  },
});

const Comment: GraphQLObjectType = new GraphQLObjectType({
  name: 'Comment',
  interfaces: [Node],
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    body: { type: new GraphQLNonNull(GraphQLString) },
    author: { type: Actor },
    createdAt: { type: new GraphQLNonNull(DateTime) },
  }),
});

const StatusChange = new GraphQLObjectType({
  name: 'StatusChange',
  fields: {
    from: { type: Status },
    to: { type: new GraphQLNonNull(Status) },
    at: { type: new GraphQLNonNull(DateTime) },
  },
});

const TimelineItem = new GraphQLUnionType({
  name: 'TimelineItem',
  types: [Comment, StatusChange],
});

const Issue: GraphQLObjectType = new GraphQLObjectType({
  name: 'Issue',
  interfaces: [Node],
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    number: { type: new GraphQLNonNull(GraphQLInt) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    body: { type: GraphQLString },
    status: { type: new GraphQLNonNull(Status) },
    priority: { type: Priority },
    author: { type: Actor },
    assignees: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(User))) },
    labels: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
    createdAt: { type: new GraphQLNonNull(DateTime) },
    closedAt: { type: DateTime },
    timeline: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(TimelineItem))) },
  }),
});

const User: GraphQLObjectType = new GraphQLObjectType({
  name: 'User',
  interfaces: [Node, Actor],
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    login: { type: new GraphQLNonNull(GraphQLString) },
    avatarUrl: { type: GraphQLString },
    name: { type: GraphQLString },
    issues: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Issue))),
      args: { first: { type: GraphQLInt, defaultValue: 10 } },
    },
  }),
});

const Bot = new GraphQLObjectType({
  name: 'Bot',
  interfaces: [Node, Actor],
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    login: { type: new GraphQLNonNull(GraphQLString) },
    avatarUrl: { type: GraphQLString },
    app: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const SearchResult = new GraphQLUnionType({
  name: 'SearchResult',
  types: [User, Issue],
});

const IssueFilter = new GraphQLInputObjectType({
  name: 'IssueFilter',
  fields: {
    status: { type: new GraphQLList(new GraphQLNonNull(Status)) },
    priority: { type: Priority },
    assignee: { type: GraphQLID },
    createdAfter: { type: DateTime },
    first: { type: new GraphQLNonNull(GraphQLInt), defaultValue: 20 },
  },
});

const CreateIssueInput = new GraphQLInputObjectType({
  name: 'CreateIssueInput',
  fields: {
    title: { type: new GraphQLNonNull(GraphQLString) },
    body: { type: GraphQLString },
    priority: { type: new GraphQLNonNull(Priority), defaultValue: 'MEDIUM' },
    labels: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
  },
});

const IssueBy = new GraphQLInputObjectType({
  name: 'IssueBy',
  isOneOf: true,
  fields: {
    id: { type: GraphQLID },
    number: { type: GraphQLInt },
  },
});

const Query = new GraphQLObjectType({
  name: 'Query',
  fields: {
    node: { type: Node, args: { id: { type: new GraphQLNonNull(GraphQLID) } } },
    issue: { type: Issue, args: { by: { type: new GraphQLNonNull(IssueBy) } } },
    issues: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Issue))),
      args: { filter: { type: IssueFilter } },
    },
    search: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(SearchResult))),
      args: { term: { type: new GraphQLNonNull(GraphQLString) } },
    },
    viewer: { type: new GraphQLNonNull(User) },
  },
});

const Mutation = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    createIssue: {
      type: new GraphQLNonNull(Issue),
      args: { input: { type: new GraphQLNonNull(CreateIssueInput) } },
    },
    closeIssue: {
      type: Issue,
      args: { id: { type: new GraphQLNonNull(GraphQLID) }, at: { type: DateTime } },
    },
  },
});

type NonNull<T extends TadaNamedTypeRef | TadaListTypeRef> = TadaNonNullTypeRef<T>;
type List<T extends TadaNamedTypeRef | TadaNonNullTypeRef | TadaListTypeRef> = TadaListTypeRef<T>;
type Scalar<Name extends string> = TadaNamedTypeRef<'SCALAR', Name>;
type Enum<Name extends string> = TadaNamedTypeRef<'ENUM', Name>;
type Obj<Name extends string> = TadaNamedTypeRef<'OBJECT', Name>;

type NodeFields = { id: NonNull<Scalar<'ID'>> };
type ActorFields = NodeFields & {
  login: NonNull<Scalar<'String'>>;
  avatarUrl: Scalar<'String'>;
};

export type contractSchema = TadaSchema<{
  query: 'Query';
  mutation: 'Mutation';
  types:
    | TadaScalarType<'DateTime', string>
    | TadaEnumType<'Status', 'OPEN' | 'IN_PROGRESS' | 'CLOSED'>
    | TadaEnumType<'Priority', 'LOW' | 'MEDIUM' | 'HIGH'>
    | TadaInterfaceType<'Node', NodeFields, 'User' | 'Bot' | 'Issue' | 'Comment'>
    | TadaInterfaceType<'Actor', ActorFields, 'User' | 'Bot'>
    | TadaObjectType<
        'Comment',
        NodeFields & {
          body: NonNull<Scalar<'String'>>;
          author: TadaNamedTypeRef<'INTERFACE', 'Actor'>;
          createdAt: NonNull<Scalar<'DateTime'>>;
        }
      >
    | TadaObjectType<
        'StatusChange',
        {
          from: Enum<'Status'>;
          to: NonNull<Enum<'Status'>>;
          at: NonNull<Scalar<'DateTime'>>;
        }
      >
    | TadaUnionType<'TimelineItem', 'Comment' | 'StatusChange'>
    | TadaObjectType<
        'Issue',
        NodeFields & {
          number: NonNull<Scalar<'Int'>>;
          title: NonNull<Scalar<'String'>>;
          body: Scalar<'String'>;
          status: NonNull<Enum<'Status'>>;
          priority: Enum<'Priority'>;
          author: TadaNamedTypeRef<'INTERFACE', 'Actor'>;
          assignees: NonNull<List<NonNull<Obj<'User'>>>>;
          labels: List<NonNull<Scalar<'String'>>>;
          createdAt: NonNull<Scalar<'DateTime'>>;
          closedAt: Scalar<'DateTime'>;
          timeline: NonNull<List<NonNull<TadaNamedTypeRef<'UNION', 'TimelineItem'>>>>;
        }
      >
    | TadaObjectType<
        'User',
        ActorFields & {
          name: Scalar<'String'>;
          issues: NonNull<List<NonNull<Obj<'Issue'>>>>;
        }
      >
    | TadaObjectType<'Bot', ActorFields & { app: NonNull<Scalar<'String'>> }>
    | TadaUnionType<'SearchResult', 'User' | 'Issue'>
    | TadaInputObjectType<
        'IssueFilter',
        {
          status: List<NonNull<Enum<'Status'>>>;
          priority: Enum<'Priority'>;
          assignee: Scalar<'ID'>;
          createdAfter: Scalar<'DateTime'>;
          first: NonNull<Scalar<'Int'>>;
        },
        'first'
      >
    | TadaInputObjectType<
        'CreateIssueInput',
        {
          title: NonNull<Scalar<'String'>>;
          body: Scalar<'String'>;
          priority: NonNull<Enum<'Priority'>>;
          labels: List<NonNull<Scalar<'String'>>>;
        },
        'priority'
      >
    | TadaInputObjectType<'IssueBy', { id: Scalar<'ID'>; number: Scalar<'Int'> }, never, true>
    | TadaObjectType<
        'Query',
        {
          node: TadaNamedTypeRef<'INTERFACE', 'Node'>;
          issue: Obj<'Issue'>;
          issues: NonNull<List<NonNull<Obj<'Issue'>>>>;
          search: NonNull<List<NonNull<TadaNamedTypeRef<'UNION', 'SearchResult'>>>>;
          viewer: NonNull<Obj<'User'>>;
        }
      >
    | TadaObjectType<
        'Mutation',
        {
          createIssue: NonNull<Obj<'Issue'>>;
          closeIssue: Obj<'Issue'>;
        }
      >;
}>;

export const schema = new GraphQLSchema({
  query: Query,
  mutation: Mutation,
  types: [Bot],
}) as GraphQLSchema & TadaSchemaCarrier<contractSchema>;

export const documents = {
  issue: `
    query Issue($by: IssueBy!) {
      issue(by: $by) {
        id
        number
        title
        body
        status
        priority
        createdAt
        closedAt
        labels
        assignees { login name }
        author {
          __typename
          login
          ... on User { name }
          ... on Bot { app }
        }
        timeline {
          __typename
          ... on Comment { body createdAt }
          ... on StatusChange { from to at }
        }
      }
    }
  `,
  issues: `
    query Issues($filter: IssueFilter) {
      issues(filter: $filter) { id status }
    }
  `,
  search: `
    query Search($term: String!) {
      search(term: $term) {
        __typename
        ... on Node { id }
        ... on User { login }
        ... on Issue { title }
      }
    }
  `,
  node: `
    query NodeById($id: ID!) {
      node(id: $id) {
        id
        ... on Actor { login avatarUrl }
      }
    }
  `,
  createIssue: `
    mutation CreateIssue($input: CreateIssueInput!) {
      createIssue(input: $input) { id priority }
    }
  `,
  closeIssue: `
    mutation CloseIssue($id: ID!, $at: DateTime) {
      closeIssue(id: $id, at: $at) { id closedAt }
    }
  `,
} as const;
