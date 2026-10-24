---
'gql.tada': minor
---

Add `gql.tada/server`, a graphql-js schema builder that emits the schema contract, so clients can pass `IntrospectionOf<typeof schema>` to `initGraphQLTada()`. `createContextCache()` creates per-request values, such as DataLoaders. Plugins passed to `initSchemaBuilder({ plugins })` wrap resolvers and add typed options to fields and types. `authPlugin()` checks `authorize` rules, composed with `and()`, `or()`, and `not()`, and `maskErrorsPlugin()` hides unexpected errors from clients.
