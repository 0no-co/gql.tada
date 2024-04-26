# @gql.tada/internal

## 0.3.0

### Minor Changes

- Add multi-schema config format and schema loading
  Submitted by [@kitten](https://github.com/kitten) (See [#257](https://github.com/0no-co/gql.tada/pull/257))

### Patch Changes

- Update `loadRef` to reflect `tada*` options to result types
  Submitted by [@kitten](https://github.com/kitten) (See [#259](https://github.com/0no-co/gql.tada/pull/259))

## 0.2.4

### Patch Changes

- Upgrade `@urql/core` in `@gql.tada/internal`
  Submitted by [@kitten](https://github.com/kitten) (See [#255](https://github.com/0no-co/gql.tada/pull/255))

## 0.2.3

### Patch Changes

- ⚠️ Fix ESM build output file to be properly loadable
  Submitted by [@kitten](https://github.com/kitten) (See [#247](https://github.com/0no-co/gql.tada/pull/247))
- ⚠️ Fix resolving `tsconfig.json`' `extends` option
  Submitted by [@kitten](https://github.com/kitten) (See [#251](https://github.com/0no-co/gql.tada/pull/251))

## 0.2.2

### Patch Changes

- Add support for `${configDir}` to directory path configs
  Submitted by [@kitten](https://github.com/kitten) (See [#239](https://github.com/0no-co/gql.tada/pull/239))

## 0.2.1

### Patch Changes

- ⚠️ Fix config parser not being able to handle `schema.headers` object
  Submitted by [@kitten](https://github.com/kitten) (See [#222](https://github.com/0no-co/gql.tada/pull/222))
- Remove `null` cases from schema loaders, simplifying error handling in the CLI
  Submitted by [@kitten](https://github.com/kitten) (See [#214](https://github.com/0no-co/gql.tada/pull/214))

## 0.2.0

**Read the full release announcement post at: https://gql-tada.0no.co/devlog/2024-04-15**

### Minor Changes

- Add `check` as a way to run the GraphQLSP diagnostics as part of our CLI
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#170](https://github.com/0no-co/gql.tada/pull/170))
- Implement new config resolution helpers
  Submitted by [@kitten](https://github.com/kitten) (See [#200](https://github.com/0no-co/gql.tada/pull/200))

### Patch Changes

- Allow GraphQL enum types to be remapped with the `scalars` configuration option
  Submitted by [@kitten](https://github.com/kitten) (See [#184](https://github.com/0no-co/gql.tada/pull/184))
- Add bundled licenses of internalized modules
  Submitted by [@kitten](https://github.com/kitten) (See [#175](https://github.com/0no-co/gql.tada/pull/175))
- Support opting out of `includeDeprecated` on `__Directive` and `__Field` in accordance with the October 2021 spec
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#192](https://github.com/0no-co/gql.tada/pull/192))
- Replace `minifyIntrospectionQuery` utility with a version that sorts fields and types by name
  Submitted by [@kitten](https://github.com/kitten) (See [#185](https://github.com/0no-co/gql.tada/pull/185))

## 0.1.3

### Patch Changes

- ⚠️ Fix `subscriptionType` not being fetched during introspection
  Submitted by [@kitten](https://github.com/kitten) (See [#172](https://github.com/0no-co/gql.tada/pull/172))

## 0.1.2

### Patch Changes

- Add `loadFromSDL` and `loadFromURL` schema loader utilities
  Submitted by [@kitten](https://github.com/kitten) (See [#163](https://github.com/0no-co/gql.tada/pull/163))
- Upgrade `@0no-co/graphql.web` to `1.0.5`
  Submitted by [@kitten](https://github.com/kitten) (See [#168](https://github.com/0no-co/gql.tada/pull/168))
- Update internal loader to merge them into one and incorporate `SchemaOrigin` parsing
  Submitted by [@kitten](https://github.com/kitten) (See [#165](https://github.com/0no-co/gql.tada/pull/165))

## 0.1.1

### Patch Changes

- Add `typescript` to `peerDependencies`
  Submitted by [@kitten](https://github.com/kitten) (See [#156](https://github.com/0no-co/gql.tada/pull/156))

## 0.1.0

### Minor Changes

- Expose introspection output format generation from `@gql.tada/internal` and implement a new pre-processed output format, which pre-computes the output of the `mapIntrospection` type
  Submitted by [@kitten](https://github.com/kitten) (See [#150](https://github.com/0no-co/gql.tada/pull/150))
- Add `@gql.tada/internal` package to extract common logic between the CLI and the LSP
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#149](https://github.com/0no-co/gql.tada/pull/149))
