---
'@gql.tada/server': minor
---

Add `@gql.tada/server`, an experimental graphql-js schema builder that emits the `gql.tada` schema contract, so clients can pass `IntrospectionOf<typeof schema>` to `initGraphQLTada()`. `createContextCache()` creates per-request values, such as DataLoaders. Plugins passed to `initSchemaBuilder({ plugins })` wrap resolvers, add extensions and directives, and add typed options to fields and object types by merging into `FieldPluginOptions` and `TypePluginOptions`.
