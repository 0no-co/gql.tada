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

| Option               | Description                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `dir`              | A relative location from your current working directory where the project should be initialized.   |

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

| Option               | Description                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `--tsconfig,-c`      | Optionally, an alternative relative location to the project’s `tsconfig.json`.      |
| `--fail-on-warn,-w`  | Triggers an error and a non-zero exit code if any warnings have been reported (default: false). |
| `--level,-l`         | The minimum severity of diagnostics to display: `info`, `warn` or `error` (default: `info`).            |

Usually, `@0no-co/graphqlsp` runs as a TypeScript language server plugin to report warnings and errors. However, these diagnostics don’t show up when `tsc` is run.

The `gql.tada check` command exists to run these diagnostics in a standalone command, outside of editing the relevant files and reports these errors to the console.

When this command is run inside a GitHub Action, [workflow commands](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions) are used to annotate errors within the GitHub UI.

### `generate-schema`

| Option               | Description                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `schema`             | A relative file path to a schema or URL to a GraphQL API to introspect.           |
| `--tsconfig,-c`      | Optionally, an alternative relative location to the project’s `tsconfig.json`.      |
| `--output,-o`        | An output location to write the `.graphql` schema file to. (Default: The `schema` configuration option) |
| `--header,`          | A key-value header entry to use when retrieving the introspection from a GraphQL API.                         |

Oftentimes, an API may not be running in development, is maintained in a separate repository, or requires authorization headers, and specifying a URL in the `schema` configuration can slow down development.

The `gql.tada generate-schema` command can output a `.graphql` SDL file from a URL and use environment variables. Using this command we can avoid having to add a URL in the `tsconfig.json` configuration.

### `generate-output`

| Option                    | Description                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `--disable-preprocessing` | Whether to use the less efficient `.d.ts` introspection format. (Default: false)                                   |
| `--tsconfig,-c`      | Optionally, an alternative relative location to the project’s `tsconfig.json`.      |
| `--output,-o`        | Specify where to output the file to. (Default: The `tadaOutputLocation` configuration option) |

The `gql.tada generate-output` command mimics the behavior of `@0no-co/graphqlsp`, outputting the `gql.tada` output file manually. It will load the schema from the specified `schema` configuration option and write the output file.

### `turbo`

| Option               | Description                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `--tsconfig,-c`      | Optionally, an alternative relative location to the project’s `tsconfig.json`.      |
| `--fail-on-warn,-w`  | Triggers an error and a non-zero exit code if any warnings have been reported. |
| `--output,-o`        | Specify where to output the file to. (Default: The `tadaTurboLocation` configuration option) |

The `turbo` command allows you to cache all the existing GraphQL query types ahead
of time. This step can make checking out the repository faster for other people and
reduce the time spent calculating the types. See it as taking a snapshot of your
current types, when you start editing your queries it will not find it in the cache
anymore and revert to the runtime behavior.

When this command is run inside a GitHub Action, [workflow commands](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions) are used to annotate errors within the GitHub UI.

### `generate-persisted`

| Option               | Description                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `--tsconfig,-c`      | Optionally, an alternative relative location to the project’s `tsconfig.json`.      |
| `--fail-on-warn,-w`  | Triggers an error and a non-zero exit code if any warnings have been reported. |
| `--output,-o`        | Specify where to output the file to. (Default: The `tadaPersistedLocation` configuration option) |

The `gql.tada generate-persisted` command will scan your code for `graphql.persisted()` calls and generate
a JSON file containing a mapping of document IDs to the GraphQL document strings.
These can then be used to register known and accepted documents (known as “persisted operations”) with your GraphQL API to lock down accepted documents that are allowed to be sent.

When this command is run inside a GitHub Action, [workflow commands](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions) are used to annotate errors within the GitHub UI.
