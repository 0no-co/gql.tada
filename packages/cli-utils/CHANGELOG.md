# @gql.tada/cli-utils

## 1.0.0

### Major Changes

- Add stdout-piping support in some commands and adjust command arguments for consistency
  Submitted by [@kitten](https://github.com/kitten) (See [#197](https://github.com/0no-co/gql.tada/pull/197))
- Add stylised log output and threading to commands
  Submitted by [@kitten](https://github.com/kitten) (See [#200](https://github.com/0no-co/gql.tada/pull/200))

### Minor Changes

- Add `gql-tada turbo` which will calculate all the types from `graphql()` calls so subsequent
  clones, ... won't have to calculate all the types
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#183](https://github.com/0no-co/gql.tada/pull/183))
- Implement `generate-persisted` as a way to go through all of the codebase and generate a persisted operations manifest
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#176](https://github.com/0no-co/gql.tada/pull/176))
- Support a second argument in `graphql.persisted` which accepts a `TadaDocumentNode` rather than passing a generic. This allows the document node to not be hidden, to still generate `documentId` via `gql.tada` without having to hide the document during runtime
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#188](https://github.com/0no-co/gql.tada/pull/188))
- Expose internal generate commands as functions exported by `@gql.tada/cli-utils` (restoring prior functionality)
  Submitted by [@kitten](https://github.com/kitten) (See [#207](https://github.com/0no-co/gql.tada/pull/207))
- Add `check` as a way to run the GraphQLSP diagnostics as part of our CLI
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#170](https://github.com/0no-co/gql.tada/pull/170))
- Add `doctor` command to diagnose common issues with the LSP and gql.tada
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#169](https://github.com/0no-co/gql.tada/pull/169))
- Add the `init` command for the CLI
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#182](https://github.com/0no-co/gql.tada/pull/182))
- Add `--tsconfig` option to the `check` command, update its log output, and add support for GitHub Actions annotations to it
  Submitted by [@kitten](https://github.com/kitten) (See [#199](https://github.com/0no-co/gql.tada/pull/199))
- Add annotations for GitHub actions to command outputs that report diagnostics
  Submitted by [@kitten](https://github.com/kitten) (See [#200](https://github.com/0no-co/gql.tada/pull/200))

### Patch Changes

- Remove interactive output in non-interactive environments
  Submitted by [@kitten](https://github.com/kitten) (See [#203](https://github.com/0no-co/gql.tada/pull/203))
- ⚠️ Fix `turbo` command reusing previously cached turbo typings. Instead, we now set a flag to disable the cache temporarily inside the command
  Submitted by [@kitten](https://github.com/kitten) (See [#208](https://github.com/0no-co/gql.tada/pull/208))
- Add bundled licenses of internalized modules
  Submitted by [@kitten](https://github.com/kitten) (See [#175](https://github.com/0no-co/gql.tada/pull/175))
- ⚠️ Fix crash in `generate turbo` command when `returnType.symbol` is undefined
  Submitted by [@kitten](https://github.com/kitten) (See [#205](https://github.com/0no-co/gql.tada/pull/205))
- Improve log output of `doctor` command
  Submitted by [@kitten](https://github.com/kitten) (See [#193](https://github.com/0no-co/gql.tada/pull/193))
- Updated dependencies (See [#184](https://github.com/0no-co/gql.tada/pull/184), [#175](https://github.com/0no-co/gql.tada/pull/175), [#170](https://github.com/0no-co/gql.tada/pull/170), [#192](https://github.com/0no-co/gql.tada/pull/192), [#185](https://github.com/0no-co/gql.tada/pull/185), and [#200](https://github.com/0no-co/gql.tada/pull/200))
  - @gql.tada/internal@0.2.0

## 0.3.3

### Patch Changes

- Updated dependencies (See [#172](https://github.com/0no-co/gql.tada/pull/172))
  - @gql.tada/internal@0.1.3

## 0.3.2

### Patch Changes

- Update CLI with new schema loaders
  Submitted by [@kitten](https://github.com/kitten) (See [#163](https://github.com/0no-co/gql.tada/pull/163))
- Update internal loader to merge them into one and incorporate `SchemaOrigin` parsing
  Submitted by [@kitten](https://github.com/kitten) (See [#165](https://github.com/0no-co/gql.tada/pull/165))
- Updated dependencies (See [#163](https://github.com/0no-co/gql.tada/pull/163), [#168](https://github.com/0no-co/gql.tada/pull/168), and [#165](https://github.com/0no-co/gql.tada/pull/165))
  - @gql.tada/internal@0.1.2

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
