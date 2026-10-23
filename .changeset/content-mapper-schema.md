---
'@gql.tada/content-mapper': minor
---

Map `.graphql` schema files configured as the GraphQLSP / `gql.tada` plugin's `schema` (or `schemas[]`) to the introspection type `gql.tada generate output` writes, so TypeScript 7.1 projects don't need a generated output file. With a single schema, `.graphql` documents are also validated against it.
