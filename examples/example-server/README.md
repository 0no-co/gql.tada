# gql.tada/server example

A GraphQL API defined with `gql.tada/server`, with a client that types its GraphQL documents
against the server's schema, without introspection or code generation.

- `src/schema/refs.ts`: references to the schema's types, which every other schema module uses
- `src/schema/*.ts`: the schema's types, split into modules that add fields to `Query`, `Mutation`, and `User`
- `src/server.ts`: serves the schema over HTTP with [`graphql-http`](https://github.com/graphql/graphql-http)
- `src/client/graphql.ts`: sets up `graphql()` with `IntrospectionOf<typeof schema>`
- `src/client/index.ts`: typed queries, fragments, and mutations using `@urql/core`

## How it works

The schema builder derives a gql.tada schema type from its definitions, which the client
imports as a type only:

```ts
import { initGraphQLTada, type IntrospectionOf } from 'gql.tada';
import type { schema } from '../schema/index.ts';

export const graphql = initGraphQLTada<{
  introspection: IntrospectionOf<typeof schema>;
}>();
```

Changing the schema updates the result and variables types of all documents immediately.

Validating documents, e.g. reporting a selected field that doesn't exist, is done by GraphQLSP
in your editor and by `gql.tada check`. Both read `schema.graphql`, which the server writes
when it starts in development, and which `pnpm emit-schema` writes on demand. `pnpm check`
writes it, validates all documents, and then type checks the server and client.

References (`t.objectRef()`, etc.) are declared in `src/schema/refs.ts`, which doesn't import
any other schema module. Schema modules may then use each other's types without running into
circular imports.

## Running

This example runs TypeScript directly with Node.js 22.18+. From the repository root, run
`pnpm install` and `pnpm build` first, then in this directory:

```sh
pnpm start       # starts the API on http://localhost:4000/graphql
pnpm client      # runs typed queries against the API (in another terminal)
pnpm check       # validates GraphQL documents and type checks the server and client
pnpm emit-schema # writes schema.graphql for GraphQLSP
```

> **Note:** `graphql` is pinned to the version the repository root uses, since the example
> imports `gql.tada/server` from the workspace, and `graphql` may only be loaded once. When
> installing `gql.tada` from npm, its `graphql` peer dependency takes care of this.
