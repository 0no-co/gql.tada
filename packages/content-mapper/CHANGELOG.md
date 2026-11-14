# @gql.tada/content-mapper

## 0.1.0

### Minor Changes

- Map the schema configured as the GraphQLSP / `gql.tada` plugin's `schema` (or `schemas[]`) to the introspection type `gql.tada generate output` writes, so TypeScript 7.1 projects don't need a generated output file. `.graphql` SDL schemas are mapped directly, and `.json` introspection schemas through a `.graphql` file that only contains `# import * from "./schema.json"`. With a single schema, `.graphql` documents are also validated against it
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#610](https://github.com/0no-co/gql.tada/pull/610))
- Add `@gql.tada/content-mapper`, a TypeScript 7.1+ content mapper that lets `.graphql` files be imported as typed `gql.tada` documents. Every operation and fragment in a `.graphql` file becomes a named export typed by your `graphql()` function, fragments are imported with `# import` comments, and diagnostics, hovers, and go-to-definition map back to the original GraphQL source
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#606](https://github.com/0no-co/gql.tada/pull/606))

### Patch Changes

- Updated dependencies (See [#610](https://github.com/0no-co/gql.tada/pull/610) and [#573](https://github.com/0no-co/gql.tada/pull/573))
  - @gql.tada/internal@1.3.0
