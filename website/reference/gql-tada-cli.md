---
title: gql.tada CLI
---

# `gql.tada` CLI (BETA)

## Commands

### `init`

| Option               | Description                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `dir`              | A relative location from your current working directory where we should be running `init`.   |

The `init` command takes care of everything required to setup a `gql.tada`
project. The main tasks involved here are:

- Getting to the schema
- Locating where we need to output your `graphql-env`
- Configuring the `tsconfig.json`
- Installing the dependencies

You can run this command with

::: code-group

```sh [npm]
npx gql-tada init ./my-project
```

```sh [pnpm]
pnpm gql-tada init ./my-project
```

```sh [yarn]
yarn gql-tada init ./my-project
```

```sh [bun]
bun gql-tada init ./my-project
```

:::

### `doctor`

The `doctor` command will check for common mistakes in the configuration of `gql.tada`
by checking the versions of `typescript`, your `tsconfig`, ...

You can run this command with

::: code-group

```sh [npm]
npx gql-tada doctor
```

```sh [pnpm]
pnpm gql-tada doctor
```

```sh [yarn]
yarn gql-tada doctor
```

```sh [bun]
bun gql-tada doctor
```

:::

### `check`

| Option               | Description                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `--tsconfig,-c`      | A relative location from your current working directory where we can find your `tsconfig`.      |
| `--fail-on-warn,-w`  | Triggers an error and a non-zero exit code if any warnings have been reported (default: false). |
| `--level,-l`         | The minimum severity of diagnostics to display: info, warn or error (default: info).            |

One of the short-comings of the LSP plugin method is that these don't run during `tsc`
hence we added the `check` command which will run the same diagnostics logic of our LSP
on your project.

Example usage could look like the following:

::: code-group

```sh [npm]
npx gql-tada check --level warn --exit-on-warn
```

```sh [pnpm]
pnpm gql-tada check --level warn --exit-on-warn
```

```sh [yarn]
yarn gql-tada check --level warn --exit-on-warn
```

```sh [bun]
bun gql-tada check --level warn --exit-on-warn
```

:::

### `generate-schema`

| Option               | Description                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `schema`             | A relative location from your current working directory where we should write the schema to.           |
| `--tsconfig,-c`      | A relative location from your current working directory where we can find your `tsconfig`.             |
| `--output,-o`        | Specify where to output the file to. (Default: The `schema` configuration option, if it's a file path) |
| `--header,`          | A header key-value string to use when retrieving the introspection from a URL.                         |

Generating your schema can sometimes be behind auth, ... with this command you can
generate the schema from a URL and use environment variables in your shell rather than
having to add them in the `tsconfig.json`.

Example usage could look like the following:

::: code-group

```sh [npm]
npx gql-tada generate-schema http://example.com --header 'Authorization: Bearer token'
```

```sh [pnpm]
pnpm gql-tada generate-schema http://example.com --header 'Authorization: Bearer token'
```

```sh [yarn]
yarn gql-tada generate-schema http://example.com --header 'Authorization: Bearer token'
```

```sh [bun]
bun gql-tada generate-schema http://example.com --header 'Authorization: Bearer token'
```

:::

### `generate-output`

| Option               | Description                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `--disable-pre`             | A relative location from your current working directory where we should write the schema to.           |
| `--tsconfig,-c`      | A relative location from your current working directory where we can find your `tsconfig`.             |
| `--output,-o`        | Specify where to output the file to. (Default: The `schema` configuration option, if it's a file path) |
| `--header,`          | A header key-value string to use when retrieving the introspection from a URL.                         |

The `generate-output` command mimics the behavior of our LSP where it will look at
your configured `schema` and output the `graphql-env` to your configured
`tadaOutputLocation`.

This command accepts 1 option `disable-preprocessing` when used this will give you the
old introspection types output which is slower.

Example usage could look like the following:

::: code-group

```sh [npm]
npx gql-tada generate-output
```

```sh [pnpm]
pnpm gql-tada generate-output
```

```sh [yarn]
yarn gql-tada generate-output
```

```sh [bun]
bun gql-tada generate-output
```

:::

### `turbo`

| Option               | Description                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `--tsconfig,-c`      | A relative location from your current working directory where we can find your `tsconfig`.      |
| `--fail-on-warn,-w`  | Triggers an error and a non-zero exit code if any warnings have been reported (default: false). |
| `--output,-o`        | Specifies where to output the file to. (Default: The `tadaTurboLocation` configuration option)  |

The `turbo` command allows you to cache all the existing GraphQL query types ahead
of time. This step can make checking out the repository faster for other people and
reduce the time spent calculating the types. See it as taking a snapshot of your
current types, when you start editing your queries it will not find it in the cache
anymore and revert to the runtime behavior.

Example usage could look like the following:

::: code-group

```sh [npm]
npx gql-tada turbo
```

```sh [pnpm]
pnpm gql-tada turbo
```

```sh [yarn]
yarn gql-tada turbo
```

```sh [bun]
bun gql-tada turbo
```

:::

### `generate-persisted`

| Option               | Description                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `--tsconfig,-c`      | A relative location from your current working directory where we can find your `tsconfig`.      |
| `--fail-on-warn,-w`  | Triggers an error and a non-zero exit code if any warnings have been reported (default: false). |
| `--output,-o`        | Specifies where to output the file to. (Default: The `tadaTurboLocation` configuration option)  |

This will look for all the `graphql.persisted()` calls in your codebase and generate
a JSON-file containing a mapping of `hash: document` which can then be used with
a server implementation to lock down your API with the documents that are allowed
to be sent.

::: code-group

```sh [npm]
npx gql-tada generate-persisted ./persisted-operations.json
```

```sh [pnpm]
pnpm gql-tada generate-persisted ./persisted-operations.json
```

```sh [yarn]
yarn gql-tada generate-persisted ./persisted-operations.json
```

```sh [bun]
bun gql-tada generate-persisted ./persisted-operations.json
```

:::
