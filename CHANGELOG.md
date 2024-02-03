# gql.tada

## 1.2.1

### Patch Changes

- Remove type name constraint from `graphql.scalar`’s type name to improve type checking performance
  Submitted by [@kitten](https://github.com/kitten) (See [#53](https://github.com/0no-co/gql.tada/pull/53))
- Improve performance of several smaller types (Thank you, [@deathemperor](https://github.com/deathemperor) & [@HaiNNT](https://github.com/HaiNNT))
  Submitted by [@kitten](https://github.com/kitten) (See [#51](https://github.com/0no-co/gql.tada/pull/51))

## 1.2.0

### Minor Changes

- Add `maskFragments` to cast data to fragment masks of a given set of fragments
  Submitted by [@kitten](https://github.com/kitten) (See [#43](https://github.com/0no-co/gql.tada/pull/43))
- Add `graphql.scalar()` utility to retrieve or type check the type of scalars and enums
  Submitted by [@kitten](https://github.com/kitten) (See [#45](https://github.com/0no-co/gql.tada/pull/45))
- Add `unsafe_readResult` to unsafely cast data to the result data of a given document
  Submitted by [@kitten](https://github.com/kitten) (See [#43](https://github.com/0no-co/gql.tada/pull/43))

### Patch Changes

- Tighten up type strictness to not accept operation documents where fragment documents are expected
  Submitted by [@kitten](https://github.com/kitten) (See [#41](https://github.com/0no-co/gql.tada/pull/41))

## 1.1.0

### Minor Changes

- Support `@_optional` and `@_required` directives on fields overriding the field types.
  When used, `@_required` can turn a nullable type into a non-nullable, and `@_optional`
  can turn non-nullable fields into nullable ones. (See [“Client-Controlled Nullability” in Graphcache for an example of a client implementing this.](https://formidable.com/open-source/urql/docs/graphcache/local-directives/#client-controlled-nullability))
  Submitted by [@kitten](https://github.com/kitten) (See [#32](https://github.com/0no-co/gql.tada/pull/32))
- Add support for `@_unmask` directive on fragments causing the fragment type to not be masked. `FragmentOf<>` will return the full result type of fragments when they’re annotated with `@_unmask` and spreading these unmasked fragments into parent documents will use their full type
  Submitted by [@kitten](https://github.com/kitten) (See [#31](https://github.com/0no-co/gql.tada/pull/31))

### Patch Changes

- Format `TadaDocumentNode` output’s third generic differently. The output of fragment definitions will now be more readable (e.g. `{ fragment: 'Name', on: 'Type', masked: true }`)
  Submitted by [@kitten](https://github.com/kitten) (See [#31](https://github.com/0no-co/gql.tada/pull/31))
- Improve performance of selection and variables inference
  Submitted by [@kitten](https://github.com/kitten) (See [#35](https://github.com/0no-co/gql.tada/pull/35))
- Improve performance of GraphQL document parser
  Submitted by [@kitten](https://github.com/kitten) (See [#34](https://github.com/0no-co/gql.tada/pull/34))

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
