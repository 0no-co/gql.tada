---
'@gql.tada/content-mapper': minor
---

Map the schema configured as the GraphQLSP / `gql.tada` plugin's `schema` (or `schemas[]`) to the introspection type `gql.tada generate output` writes, so TypeScript 7.1 projects don't need a generated output file. `.graphql` SDL schemas are mapped directly, and `.json` introspection schemas through a `.graphql` file that only contains `# import * from "./schema.json"`. With a single schema, `.graphql` documents are also validated against it.
