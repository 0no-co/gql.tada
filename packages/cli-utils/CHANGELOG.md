# @gql.tada/cli-utils

## 1.3.9

### Patch Changes

- ⚠️ Fix Vue not transpiling to `.tsx` files properly due to missing SFC plugin
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#305](https://github.com/0no-co/gql.tada/pull/305))

## 1.3.8

### Patch Changes

- ⚠️ Fix typo on VSCode Syntax extension detection in `doctor` command
  Submitted by [@kitten](https://github.com/kitten) (See [#303](https://github.com/0no-co/gql.tada/pull/303))

## 1.3.7

### Patch Changes

- Support `@vue/language-core@^2.0.1`'s updated public API
  Submitted by [@kitten](https://github.com/kitten) (See [#301](https://github.com/0no-co/gql.tada/pull/301))

## 1.3.6

### Patch Changes

- ⚠️ Fix modules not being resolved correctly when using `turbo` with `pnpm`-installed `gql.tada`
  Submitted by [@kitten](https://github.com/kitten) (See [#298](https://github.com/0no-co/gql.tada/pull/298))

## 1.3.5

### Patch Changes

- Updated dependencies (See [#296](https://github.com/0no-co/gql.tada/pull/296) and [#295](https://github.com/0no-co/gql.tada/pull/295))
  - @gql.tada/internal@1.0.0

## 1.3.4

### Patch Changes

- Update CLI and `@gql.tada/internal` to variably support graphql `^15.5.0` in addition to the preferred v16, and include future support for v17
  Submitted by [@kitten](https://github.com/kitten) (See [#282](https://github.com/0no-co/gql.tada/pull/282))
- Disable output piping on GitHub CI, as it can't reliably be detected
  Submitted by [@kitten](https://github.com/kitten) (See [#286](https://github.com/0no-co/gql.tada/pull/286))
- Updated dependencies (See [#284](https://github.com/0no-co/gql.tada/pull/284) and [#282](https://github.com/0no-co/gql.tada/pull/282))
  - @gql.tada/internal@0.4.0

## 1.3.3

### Patch Changes

- Add missing fragment deduplication to `generate persisted` command's output and add document normalization, which can be disabled using the `--disable-normalization` argument
  Submitted by [@kitten](https://github.com/kitten) (See [#275](https://github.com/0no-co/gql.tada/pull/275))

## 1.3.2

### Patch Changes

- Updated dependencies (See [#270](https://github.com/0no-co/gql.tada/pull/270))
  - @gql.tada/internal@0.3.3

## 1.3.1

### Patch Changes

- Add missing default compiler options when instantiating TypeScript in `check`, `generate persisted`, and `turbo` commands
  Submitted by [@kitten](https://github.com/kitten) (See [#266](https://github.com/0no-co/gql.tada/pull/266))
- Updated dependencies (See [#268](https://github.com/0no-co/gql.tada/pull/268))
  - @gql.tada/internal@0.3.2

## 1.3.0

### Minor Changes

- Add multi-schema support to the CLI (See [RFC](https://github.com/0no-co/gql.tada/issues/248) for more details.) With multi-schema support, the configuration now accepts `schemas` as an option to set up multiple schemas that can be instantiated with `initGraphQLTada()` in parallel in the same codebase
  Submitted by [@kitten](https://github.com/kitten) (See [#261](https://github.com/0no-co/gql.tada/pull/261))
- Implement multi-schema support. Read more about it [in the v1.6.0 Devlog post](https://gql-tada.0no.co/devlog/2024-04-26).
  Submitted by undefined (See https://github.com/0no-co/gql.tada/pull/261)

### Patch Changes

- Upgrade to `@0no-co/graphqlsp@^0.12.0`
  Submitted by [@kitten](https://github.com/kitten) (See [#264](https://github.com/0no-co/gql.tada/pull/264))
- Updated dependencies (See https://github.com/0no-co/gql.tada/pull/261)
  - @gql.tada/internal@0.3.1

## 1.2.2

### Patch Changes

- Upgrade `@vue/language-core` and maintain backwards-compatibility
  Submitted by [@kitten](https://github.com/kitten) (See [#253](https://github.com/0no-co/gql.tada/pull/253))
- Instantiate TypeScript from project root rather than config path
  Submitted by [@kitten](https://github.com/kitten) (See [#254](https://github.com/0no-co/gql.tada/pull/254))
- Updated dependencies (See [#255](https://github.com/0no-co/gql.tada/pull/255))
  - @gql.tada/internal@0.2.4

## 1.2.1

### Patch Changes

- Refactor internal TypeScript instantiation (affects `turbo`, `check`, and `generate-persisted` commands)
  Submitted by [@kitten](https://github.com/kitten) (See [#247](https://github.com/0no-co/gql.tada/pull/247))
- ⚠️ Fix resolution of default lib path when libs aren't in standard location
  Submitted by [@kitten](https://github.com/kitten) (See [#251](https://github.com/0no-co/gql.tada/pull/251))
- ⚠️ Fix ESM build output file to be properly loadable
  Submitted by [@kitten](https://github.com/kitten) (See [#247](https://github.com/0no-co/gql.tada/pull/247))
- ⚠️ Fix log message of `generate schema` to correctly display schema rather than output
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#249](https://github.com/0no-co/gql.tada/pull/249))
- Updated dependencies (See [#247](https://github.com/0no-co/gql.tada/pull/247) and [#251](https://github.com/0no-co/gql.tada/pull/251))
  - @gql.tada/internal@0.2.3

## 1.2.0

### Minor Changes

- Add experimental support for `.svelte` files for the `turbo`, `generate-persisted`, and `check` commands. (Note: `@0no-co/graphqlsp` does not yet have support for Svelte, Vue & Volar)
  Submitted by [@kitten](https://github.com/kitten) (See [#241](https://github.com/0no-co/gql.tada/pull/241))
- Add support for `${configDir}` to directory path configs. When used in paths in our configuration, `${configDir}` will be substituted with the location of the main `tsconfig.json`
  Submitted by [@kitten](https://github.com/kitten) (See [#239](https://github.com/0no-co/gql.tada/pull/239))

### Patch Changes

- Updated dependencies (See [#239](https://github.com/0no-co/gql.tada/pull/239))
  - @gql.tada/internal@0.2.2

## 1.1.1

### Patch Changes

- Use the Vue SFC compiler's source-maps when looking up positions in its TypeScript file output
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#236](https://github.com/0no-co/gql.tada/pull/236))

## 1.1.0

### Minor Changes

- Add experimental support for `.vue` SFC files for the `turbo`, `generate-persisted`, and `check` commands. (**Note:** `@0no-co/graphqlsp` does not yet have support for Vue & Volar)
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#232](https://github.com/0no-co/gql.tada/pull/232))

### Patch Changes

- Add checks for VSCode extensions to `doctor` command. The command now outputs a warning if the GraphQL syntax plugin is missing or if the GraphQL Language service is installed and misconfigured
  Submitted by [@kitten](https://github.com/kitten) (See [#230](https://github.com/0no-co/gql.tada/pull/230))

## 1.0.3

### Patch Changes

- Add missing argument to `generate-output` command to force output the `.ts` format instead
  Submitted by [@kitten](https://github.com/kitten) (See [#227](https://github.com/0no-co/gql.tada/pull/227))
- ⚠️ Fix `generate-output` command outputting the `.d.ts` format when `.ts` extension was specified instead
  Submitted by [@llllvvuu](https://github.com/llllvvuu) (See [#225](https://github.com/0no-co/gql.tada/pull/225))

## 1.0.2

### Patch Changes

- Remove `null` cases from schema loaders, simplifying error handling in the CLI
  Submitted by [@kitten](https://github.com/kitten) (See [#214](https://github.com/0no-co/gql.tada/pull/214))
- Updated dependencies (See [#222](https://github.com/0no-co/gql.tada/pull/222) and [#214](https://github.com/0no-co/gql.tada/pull/214))
  - @gql.tada/internal@0.2.1

## 1.0.1

### Patch Changes

- ⚠️ Fix hash parsing in `generate-persisted` command
  Submitted by [@kitten](https://github.com/kitten) (See [#212](https://github.com/0no-co/gql.tada/pull/212))

## 1.0.0

**Read the full release announcement post at: https://gql-tada.0no.co/devlog/2024-04-15**

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
