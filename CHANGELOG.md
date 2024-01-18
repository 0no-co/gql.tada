# gql.tada

## 1.0.3

### Patch Changes

- Prevent type inference for schemas with “huge” root types (i.e. types with an excessive amount of fields) from failing introspection mapping
  Submitted by [@kitten](https://github.com/kitten) (See [#25](https://github.com/0no-co/gql.tada/pull/25))
- Remove redundant constraint on `IntrospectionQuery` data. When the full type is used as an `extends`, the input type (which can be a huge schema), is checked against this type, which forces a full evaluation. This means that TypeScript may spend multiple seconds in `recursiveTypeRelatedTo`. This work has been eliminated and should help performance
  Submitted by [@kitten](https://github.com/kitten) (See [#26](https://github.com/0no-co/gql.tada/pull/26))

## 1.0.2

### Patch Changes

- ⚠️ Fix `readFragment()` not inferring the types of complex fragments, i.e. fragments that derive with a union type
  Submitted by [@kitten](https://github.com/kitten) (See [#15](https://github.com/0no-co/gql.tada/pull/15))
- Make `$tada.fragmentRefs` property required. Previously, this was optional (to mirror what GCG’s client-preset does). However, this can lead to invalid checks in `readFragment`, as it would be able to match types that don’t actually match the fragment refs
  Submitted by [@kitten](https://github.com/kitten) (See [#18](https://github.com/0no-co/gql.tada/pull/18))

## 1.0.1

### Patch Changes

- ⚠️ Fix `__typename` literal string not being exact and instead a union of possible types, when the `__typename` field is put onto an abstract type’s selection set
  Submitted by [@kitten](https://github.com/kitten) (See [#11](https://github.com/0no-co/gql.tada/pull/11))

## 1.0.0

**Initial Release**

`gql.tada` is a GraphQL document authoring library, inferring the result and variables types
of GraphQL queries and fragments in the TypeScript type system. It derives the types for your
GraphQL queries on the fly allowing you to write type-safe GraphQL documents quickly.

To get started, check out the [documentation’s “Get Started” section.](https://gql-tada.0no.co/)
