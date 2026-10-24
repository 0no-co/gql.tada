# @gql.tada/server

> [!WARNING]
> This package is experimental. Its API may change in minor releases until it reaches v1.

**`@gql.tada/server`** is a schema builder for [`graphql`](https://github.com/graphql/graphql-js).
It derives a [`gql.tada`](https://gql-tada.0no.co/) schema type from its definitions, so clients
in the same codebase type their GraphQL documents against the schema, without introspection or
code generation.

```sh
npm install @gql.tada/server gql.tada graphql
```

```ts
import { initSchemaBuilder } from '@gql.tada/server';

const t = initSchemaBuilder<{ context: { userId: string } }>();

const Query = t.object(t.objectRef()('Query'), {
  fields: (f) => ({
    me: f.field({ type: t.nonNull(t.ID), resolve: (_, _args, ctx) => ctx.userId }),
  }),
});

export const schema = t.schema({ query: Query });
```

```ts
import { initGraphQLTada, type IntrospectionOf } from 'gql.tada';
import type { schema } from './schema';

export const graphql = initGraphQLTada<{ introspection: IntrospectionOf<typeof schema> }>();
```

Read more in the [Schema Builder](https://gql-tada.0no.co/guides/schema-builder) and
[Server Plugins](https://gql-tada.0no.co/guides/server-plugins) guides.
