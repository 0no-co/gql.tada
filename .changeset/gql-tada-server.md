---
'gql.tada': minor
---

Add `gql.tada/server`, a graphql-js schema builder that emits the schema contract, so clients can pass `IntrospectionOf<typeof schema>` to `initGraphQLTada()`. `createContextCache()` creates per-request values, such as DataLoaders.
