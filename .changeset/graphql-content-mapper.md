---
'@gql.tada/content-mapper': minor
---

Add `@gql.tada/content-mapper`, a TypeScript 7.1+ content mapper that lets `.graphql` files be imported as typed `gql.tada` documents. Every operation and fragment in a `.graphql` file becomes a named export typed by your `graphql()` function, fragments are imported with `# import` comments, and diagnostics, hovers, and go-to-definition map back to the original GraphQL source.
