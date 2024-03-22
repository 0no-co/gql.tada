# @gql.tada/cli-utils

## 0.3.1

### Patch Changes

- Add `typescript` to `peerDependencies`
  Submitted by [@kitten](https://github.com/kitten) (See [#156](https://github.com/0no-co/gql.tada/pull/156))
- Updated dependencies (See [#156](https://github.com/0no-co/gql.tada/pull/156))
  - @gql.tada/internal@0.1.1

## 0.3.0

### Minor Changes

- Enable pre-processed introspection output by default (since it only applies to `d.ts` outputs)
  Submitted by [@kitten](https://github.com/kitten) (See [#155](https://github.com/0no-co/gql.tada/pull/155))
- Expose introspection output format generation from `@gql.tada/internal` and implement a new pre-processed output format, which pre-computes the output of the `mapIntrospection` type
  Submitted by [@kitten](https://github.com/kitten) (See [#150](https://github.com/0no-co/gql.tada/pull/150))
- Add `@gql.tada/internal` package to extract common logic between the CLI and the LSP
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#149](https://github.com/0no-co/gql.tada/pull/149))

### Patch Changes

- Updated dependencies (See [#150](https://github.com/0no-co/gql.tada/pull/150) and [#149](https://github.com/0no-co/gql.tada/pull/149))
  - @gql.tada/internal@0.1.0

## 0.2.0

### Minor Changes

- Abstract core logic for `generate-schema` and `generate-output` CLI commands into importable Node.js API's
  Submitted by [@matthewvolk](https://github.com/matthewvolk) (See [#135](https://github.com/0no-co/gql.tada/pull/135))

## 0.1.2

### Patch Changes

- ⚠️ Fix generate-schema not forwarding single header
  Submitted by [@deini](https://github.com/deini) (See [#131](https://github.com/0no-co/gql.tada/pull/131))

## 0.1.1

### Patch Changes

- Add `generate-schema` command which takes a URL | path to a JSON file and outputs a graphql schema. Example: `gql-tada generate-schema https://example.com ./schema.graphql --header 'authorization: bearer token'`
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#120](https://github.com/0no-co/gql.tada/pull/120))

## 0.1.0

### Minor Changes

- Add CLI entrypoint `gql-tada` capable of generating the types file without the LSP running
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#58](https://github.com/0no-co/gql.tada/pull/58))
