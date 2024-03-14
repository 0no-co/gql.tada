# @gql.tada/cli-utils

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
