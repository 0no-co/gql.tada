---
"gql.tada": minor
---

Support [fragment arguments](https://github.com/graphql/graphql-spec/pull/1081) in the type-level parser. `fragment Fields($size: Int! = 64) on Product` and `...Fields(size: $size)` now parse, exposing `variableDefinitions` on fragment definitions and `arguments` on fragment spreads. Fragment arguments stay scoped to their fragment, so they never appear in the operation's `VariablesOf`, and a fragment document's own `VariablesOf` reports its argument definitions. Requires `@0no-co/graphql.web@^1.4.0` for the matching runtime parser.
