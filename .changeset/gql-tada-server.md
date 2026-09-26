---
'gql.tada': minor
---

Add `gql.tada/server`, a schema builder for embedded GraphQL APIs that derives a gql.tada schema type from its definitions, and a public schema contract (`TadaSchema`, `IntrospectionOf`, and helper types, also exported from `gql.tada`) that other schema builders may emit. Clients may pass `IntrospectionOf<typeof schema>` to `initGraphQLTada()` to type documents against a schema without code generation. `createContextCache()` creates per-request values, such as DataLoaders.
