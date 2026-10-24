---
title: Schema Builder
description: How to define a GraphQL API with gql.tada/server and type documents against it without code generation.
---

# Schema Builder

<section>
  <code>gql.tada/server</code> defines a GraphQL schema in TypeScript
  with <code>graphql</code>'s type system. It derives the schema's
  type from your definitions, so clients in the same codebase type
  their documents against it, without introspection or code generation.
</section>

The builder returns a regular `GraphQLSchema`, which works with any GraphQL
server that accepts one, such as `graphql-http`, GraphQL Yoga, or Apollo Server.
The schema also carries its type as a [schema contract](/guides/schema-contract),
which clients read with `IntrospectionOf<typeof schema>`.

Resolvers are typed by the types of their fields, and fields without a resolver
are checked against the values that their parents resolve to.

::: tip
The [`examples/example-server`](https://github.com/0no-co/gql.tada/tree/main/examples/example-server)
directory contains a complete API with a typed client, including
[plugins and authorization](/guides/server-plugins).
:::

---

## Installation

`gql.tada/server` is an entrypoint of `gql.tada`. It requires `graphql` v16
or v17, which `gql.tada` lists as an optional peer dependency.

::: code-group

```sh [npm]
npm install gql.tada graphql
```

```sh [pnpm]
pnpm add gql.tada graphql
```

```sh [yarn]
yarn add gql.tada graphql
```

```sh [bun]
bun add gql.tada graphql
```

:::

---

## Creating a builder

`initSchemaBuilder()` creates a builder, `t`. Its `context` option types the
context value that your GraphQL server passes to resolvers.

```ts [src/schema/builder.ts]
import { initSchemaBuilder } from 'gql.tada/server';

export interface Context {
  db: Database;
  viewerId: string | null;
}

export const t = initSchemaBuilder<{ context: Context }>();
```

The builder exposes the built-in scalars as `t.ID`, `t.String`, `t.Int`,
`t.Float`, and `t.Boolean`. Types are nullable unless they're wrapped with
`t.nonNull()`, and lists are created with `t.list()`. Both are also exported
as `nonNull()` and `list()`.

---

## Defining object types

Object types are defined from references. A reference carries a type's name
and its backing type, which is the type of values that resolvers return for it.

```ts [src/schema/refs.ts]
import { t } from './builder';

export const Query = t.objectRef()('Query');
export const User = t.objectRef<UserModel>()('User');
export const Todo = t.objectRef<TodoModel>()('Todo');
```

`t.object()` defines a reference's fields. `f.field()` takes the field's
`type`, and optionally `args`, a `resolve` function, a `description`, and
a `deprecationReason`. Objects also accept a `description`, `interfaces`
they implement, and an `isTypeOf` function.

```ts [src/schema/todos.ts]
import { t } from './builder';
import { Query, Todo, User } from './refs';

export const TodoType = t.object(Todo, {
  fields: (f) => ({
    // Fields without a resolver read the property of the same name
    id: f.field({ type: t.nonNull(t.ID) }),
    text: f.field({ type: t.nonNull(t.String) }),
    author: f.field({
      type: t.nonNull(User),
      resolve: (todo, _args, ctx) => ctx.db.users.get(todo.authorId)!,
    }),
  }),
});

export const TodoQueries = t.object(Query, {
  fields: (f) => ({
    todo: f.field({
      type: Todo,
      args: { id: t.nonNull(t.ID) },
      resolve: (_, args, ctx) => ctx.db.todos.get(args.id),
    }),
  }),
});
```

Resolvers receive the parent value typed as the backing type, the arguments,
and the context. Their return values are checked against the field's type,
and a field without a resolver must match a property of the backing type.

Calling `t.object()` again with the same reference extends the type. This
lets each module add its own fields to `Query`, `Mutation`, or any other type.
Declaring references in a module that doesn't import other schema modules
lets every module use them without circular imports.

### Arguments and input values

Arguments, and fields of input objects, take either a type or an object with
a `type`, a `defaultValue`, a `description`, and a `deprecationReason`.
Values with a default are non-optional in resolvers, and optional for clients.

```ts
const TodoFilter = t.input('TodoFilter', {
  fields: {
    status: TodoStatus,
    first: { type: t.nonNull(t.Int), defaultValue: 10 },
  },
});
```

Set `isOneOf: true` to define a [OneOf Input Object](https://github.com/graphql/graphql-spec/pull/825),
of which exactly one field must be set. This requires `graphql` v16.9 or later.

### Subscriptions

Fields of the subscription root type take a `subscribe` function returning an
`AsyncIterable`. Each event it emits is passed to `resolve` as its parent value.

```ts
export const Subscription = t.object(t.objectRef()('Subscription'), {
  fields: (f) => ({
    todoAdded: f.field({
      type: t.nonNull(Todo),
      subscribe: (_, _args, ctx) => ctx.events.on('todoAdded'),
      resolve: (todo) => todo,
    }),
  }),
});
```

---

## Defining other types

| Method                         | Description                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `t.enum(name, { values })`     | An enum. `values` is a list of names, or an object of names to their `value`, which resolvers use internally. |
| `t.input(name, { fields })`    | An input object.                                                                                              |
| `t.union(name, { types })`     | A union of object types, with a `resolveType` function.                                                       |
| `t.interface(ref, { fields })` | An interface, from a `t.interfaceRef()`. Objects implement it with `interfaces: [ref]`.                       |
| `t.scalar(name, config)`       | A custom scalar. Clients see it as the return type of `serialize`.                                            |
| `t.directive(name, config)`    | A custom directive, which `t.apply(directive, args)` applies via the `directives` option of types and fields. |

`t.enumRef()`, `t.inputRef()`, and `t.unionRef()` create references for types
that reference themselves, or that are defined by several calls. All types,
fields, and input values accept `directives` and `extensions`.

```ts
const DateTime = t.scalar('DateTime', {
  serialize: (value: Date) => value.toISOString(),
  parseValue: (value) => new Date(value as string),
});

const SearchResult = t.union('SearchResult', {
  types: [User, Todo],
  resolveType: (value) => ('text' in value ? 'Todo' : 'User'),
});
```

---

## Creating the schema

`t.schema()` creates and validates the `GraphQLSchema`. It takes the root
types, and all type definitions in `types`, including every definition
that extends a type.

```ts [src/schema/index.ts]
import { t } from './builder';
import { Query, Mutation } from './refs';

export const schema = t.schema({
  query: Query,
  mutation: Mutation,
  types: [TodoType, TodoQueries, TodoMutations, UserType, DateTime, SearchResult],
});
```

Leaving out a type that's referenced by another type is a type error, which
names the missing type. `t.schema()` also accepts `directives`, `description`,
`schemaDirectives`, and `assumeValid`, and a `name` for
[multiple schemas](/guides/multiple-schemas).

---

## Typing documents

Clients pass the schema's type to `initGraphQLTada()`. Import the schema with
`import type`, so that none of your server's code ends up in your client.

```ts [src/client/graphql.ts]
import { initGraphQLTada, type IntrospectionOf } from 'gql.tada';
import type { schema } from '../schema';

export const graphql = initGraphQLTada<{
  introspection: IntrospectionOf<typeof schema>;
}>();
```

GraphQLSP and `gql.tada check` validate documents against a schema file,
which you can write with `printSchema(schema)` from `graphql`, for example
when your server starts in development.

---

## Per-request values

`createContextCache()` creates a function that returns one value per context
object. Since resolvers receive the same context for the duration of a request,
this creates values that all resolvers of a request share, such as DataLoaders,
without creating them upfront.

```ts
import DataLoader from 'dataloader';
import { createContextCache } from 'gql.tada/server';

const userLoader = createContextCache(
  (ctx: Context) => new DataLoader((ids: readonly string[]) => ctx.db.getUsers(ids))
);

// In a resolver:
resolve: (todo, _args, ctx) => userLoader(ctx).load(todo.authorId),
```

The context must be an object, so your GraphQL server must pass one.

<a href="/guides/server-plugins" class="button">
  <h3>Server Plugins</h3>
  <p>Learn how to add authorization and error masking</p>
</a>
