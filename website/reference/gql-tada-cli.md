---
title: gql.tada CLI
---

# `gql.tada` CLI <Badge type="warning" text="beta" />

## Commands

### `init`

> [!NOTE]
>
> The `gql.tada init` command is still a work in progress.
> If you run into any trouble, feel free to let us know what you’d like to see added or changed.

| Option | Description                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------ |
| `dir`  | A relative location from your current working directory where the project should be initialized. |

The `init` command takes care of everything required to setup a `gql.tada`
project. The main tasks involved here are:

- Locating the schema
- Locating where `gql.tada`’s `graphql-env.d.ts` shall be placed
- Configuring the `tsconfig.json`
- Installing required dependencies

You can run this command with your preferred package manager:

::: code-group

```sh [npm]
npx gql.tada init ./my-project
```

```sh [pnpm]
pnpx gql.tada init ./my-project
```

```sh [bun]
bunx gql.tada init ./my-project
```

:::

### `doctor`

> [!NOTE]
>
> The `gql.tada doctor` command is still a work in progress.
> If you run into any trouble, feel free to let us know what you’d like to see added or changed.

The `doctor` command will check for common mistakes in the `gql.tada`’s setup and configuration. It will check installed versions of packages, check the configuration, and check the schema.

### `check`

| Option              | Description                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `--tsconfig,-c`     | Optionally, a `tsconfig.json` file to use instead of an automatically discovered one.             |
| `--fail-on-warn,-w` | Triggers an error and a non-zero exit code if any warnings have been reported (default: `false`). |
| `--level,-l`        | The minimum severity of diagnostics to display: `info`, `warn` or `error` (default: `info`).      |

Usually, `@0no-co/graphqlsp` runs as a TypeScript language server plugin to report warnings and errors. However, these diagnostics don’t show up when `tsc` is run.

The `gql.tada check` command exists to run these diagnostics in a standalone command, outside of editing the relevant files and reports these errors to the console.

When this command is run inside a GitHub Action, [workflow commands](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions) are used to annotate errors within the GitHub UI.

### `generate-schema`

| Option          | Description                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `schema`        | URL to a GraphQL API or a path to a `.graphql` SDL file or introspection JSON.                       |
| `--tsconfig,-c` | Optionally, a `tsconfig.json` file to use instead of an automatically discovered one.                |
| `--output,-o`   | An output location to write the `.graphql` SDL file to. (Default: The `schema` configuration option) |
| `--header,`     | A `key:value` header entry to use when retrieving the introspection from a GraphQL API.              |

Oftentimes, an API may not be running in development, is maintained in a separate repository, or requires authorization headers, and specifying a URL in the `schema` configuration can slow down development.

The `gql.tada generate-schema` command introspects a targeted GraphQL API by URL, a `.graphql` SDL
or introspection JSON file, and outputs a `.graphql` SDL file. Generating a `.graphql` SDL file is
useful if we're trying to avoid adding a URL as the `schema` configuration option.

The SDL file will be written to the location specified by the `schema` configuration option,
which can be overridden using the `--output` argument.

### `generate-output`

| Option                    | Description                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `--disable-preprocessing` | Whether to use the less efficient `.d.ts` introspection format. (Default: false)              |
| `--tsconfig,-c`           | Optionally, a `tsconfig.json` file to use instead of an automatically discovered one.         |
| `--output,-o`             | Specify where to output the file to. (Default: The `tadaOutputLocation` configuration option) |

The `gql.tada generate-output` command mimics the behavior of `@0no-co/graphqlsp`, outputting the `gql.tada` output file manually. It will load the schema from the specified `schema` configuration option and write the output file.

The output file will be written to the location specified by the `tadaOutputLocation` configuration
option, which can be overridden using the `--output` argument.

### `turbo`

| Option              | Description                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `--tsconfig,-c`     | Optionally, a `tsconfig.json` file to use instead of an automatically discovered one.        |
| `--fail-on-warn,-w` | Triggers an error and a non-zero exit code if any warnings have been reported.               |
| `--output,-o`       | Specify where to output the file to. (Default: The `tadaTurboLocation` configuration option) |

The `turbo` command generates a cache for all GraphQL document types ahead of time.

This cache speeds up type evaluation and is especially useful when it's checked into the
repository after making changes to GraphQL documents, which speeds up all further type
checks and evaluation.

The cache is a snapshot of all current `gql.tada` types. As you edit GraphQL documents,
`gql.tada` will still infer types dynamically until a new cache file is generated.

The cache file will be written to the location specified by the `tadaTurboLocation` configuration
option, which can be overridden using the `--output` argument.

When this command is run inside a GitHub Action, [workflow commands](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions) are used to annotate errors within the GitHub UI.

### `generate-persisted`

| Option              | Description                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `--disable-normalization`     | Whether to disable normalizing the GraphQL document. (Default: false) |
| `--tsconfig,-c`     | Optionally, a `tsconfig.json` file to use instead of an automatically discovered one.            |
| `--fail-on-warn,-w` | Triggers an error and a non-zero exit code if any warnings have been reported.                   |
| `--output,-o`       | Specify where to output the file to. (Default: The `tadaPersistedLocation` configuration option) |

The `gql.tada generate-persisted` command will scan your code for `graphql.persisted()` calls and generate
a JSON manifest file containing a mapping of document IDs to the GraphQL document strings.
These can then be used to register known and accepted documents (known as “persisted operations”) with your GraphQL API to lock down accepted documents that are allowed to be sent.

The manifest file will be written to the location specified by the `tadaPersistedLocation` configuration
option, which can be overridden using the `--output` argument.

When this command is run inside a GitHub Action, [workflow commands](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions) are used to annotate errors within the GitHub UI.

## Functions

The CLI is packaged as a module that `gql.tada` depends on published as `@gql.tada/cli-utils`.
If you're looking to generate the file that the CLI generates in your own scripts, you can
use the functions it exports directly.

### `generateOutput()`

|                               | Description                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `output` option               | The filename to write the output file to (Default: the `tadaOutputLocation` configuration option) |
| `tsconfig` option             | The `tsconfig.json` to use instead of an automatically discovered one.                            |
| `disablePreprocessing` option | Whether to disable the optimized output format for `.d.ts` files.                                 |
| returns                       | A `Promise` that resolves when the task completes.                                                |

The `generateOutput()` function outputs the `gql.tada` output file manually. It will load the schema from the specified `schema` configuration option and write the output file.

The output file will be written to the location specified by the `tadaOutputLocation` configuration
option, which can be overridden using the `output` option.

```ts twoslash
import { generateOutput } from '@gql.tada/cli-utils';

await generateOutput({
  output: './src/graphql-env.d.ts',
  disablePreprocessing: false,
  tsconfig: undefined,
});
```

---

### `generatePersisted()`

|                     | Description                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `disableNormalization`     | Disables normalizing the GraphQL document |
| `output` option     | The filename to write the persisted JSON manifest file to (Default: the `tadaPersistedLocation` configuration option) |
| `tsconfig` option   | The `tsconfig.json` to use instead of an automatically discovered one.                                                |
| `failOnWarn` option | Whether to throw an error instead of logging warnings.                                                                |
| returns             | A `Promise` that resolves when the task completes.                                                                    |

The `generatePersisted()` function will scan your code for `graphql.persisted()` calls and generate
a JSON manifest file containing a mapping of document IDs to the GraphQL document strings.
These can then be used to register known and accepted documents (known as “persisted operations”) with your GraphQL API to lock down accepted documents that are allowed to be sent.

The manifest file will be written to the location specified by the `tadaPersistedLocation` configuration
option, which can be overridden using the `output` option.

```ts twoslash
import { generatePersisted } from '@gql.tada/cli-utils';

await generatePersisted({
  output: './persisted.json',
  failOnWarn: false,
  tsconfig: undefined,
});
```

---

### `generateSchema()`

|                   | Description                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `input` option    | The filename to a `.graphql` SDL file, introspection JSON, or URL to a GraphQL API to introspect.      |
| `headers` option  | Optionally, an object of headers to send when introspecting a GraphQL API.                             |
| `output` option   | The filename to write the persisted JSON manifest file to (Default: the `schema` configuration option) |
| `tsconfig` option | The `tsconfig.json` to use instead of an automatically discovered one.                                 |
| returns           | A `Promise` that resolves when the task completes.                                                     |

The `generateSchema()` function introspects a targeted GraphQL API by URL, a `.graphql` SDL
or introspection JSON file, and outputs a `.graphql` SDL file. Generating a `.graphql` SDL file is
useful if we're trying to avoid adding a URL as the `schema` configuration option.

The SDL file will be written to the location specified by the `schema` configuration option,
which can be overridden using the `output` option.

```ts twoslash
import { generateSchema } from '@gql.tada/cli-utils';

await generateSchema({
  input: 'https://trygql.formidable.dev/graphql/basic-pokedex',
  output: './schema.graphql',
  headers: undefined,
  tsconfig: undefined,
});
```

---

### `generateTurbo()`

|                     | Description                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `output` option     | The filename to write the cache file to (Default: the `tadaTurboLocation` configuration option) |
| `tsconfig` option   | The `tsconfig.json` to use instead of an automatically discovered one.                          |
| `failOnWarn` option | Whether to throw an error instead of logging warnings.                                          |
| returns             | A `Promise` that resolves when the task completes.                                              |

The `generateTurbo()` function generates a cache for all GraphQL document types ahead of time.

This cache speeds up type evaluation and is especially useful when it's checked into the
repository after making changes to GraphQL documents, which speeds up all further type
checks and evaluation.

The cache is a snapshot of all current `gql.tada` types. As you edit GraphQL documents,
`gql.tada` will still infer types dynamically until a new cache file is generated.

The cache file will be written to the location specified by the `tadaTurboLocation` configuration
option, which can be overridden using the `output` option.

```ts twoslash
import { generateTurbo } from '@gql.tada/cli-utils';

await generateTurbo({
  output: './src/graphql-cache.d.ts',
  failOnWarn: false,
  tsconfig: undefined,
});
```
