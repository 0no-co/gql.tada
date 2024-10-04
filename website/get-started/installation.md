---
title: Installation
description: How to get set up and ready
---

# Installation

We’ll go through the steps to get `gql.tada` set up properly.
A quick demo of what this looks like can be found [in an example project in the `gql.tada`
repository.](https://github.com/0no-co/gql.tada/blob/main/examples/example-pokemon-api/)

With `gql.tada`, you'll mainly interact with three different parts of the library:
- the library code you import from the `gql.tada` package
- the TypeScript plugin, `gql.tada/ts-plugin`
- and [the `gql.tada` CLI](/get-started/workflows)

## <span data-step="1">Step 1 —</span> Installing packages

We’ll start by installing `gql.tada` as a dependency.

::: code-group

```sh [npm]
npm install gql.tada
```

```sh [pnpm]
pnpm add gql.tada
```

```sh [yarn]
yarn add gql.tada
```

```sh [bun]
bun add gql.tada
```

:::

Next, we’ll add the TypeScrpt plugin to our `tsconfig.json` to set it up in TypeScript’s
language server. This is the main configuration for both the TypeScript plugin and the
`gql.tada` CLI at the same time.

::: code-group
```json [tsconfig.json]
{
  "compilerOptions": {
    "strict": true,
    "plugins": [ // [!code ++]
      { // [!code ++]
        "name": "gql.tada/ts-plugin", // [!code ++]
        "schema": "./schema.graphql", // [!code ++]
        "tadaOutputLocation": "./src/graphql-env.d.ts" // [!code ++]
      } // [!code ++]
    ] // [!code ++]
  }
}
```
:::

Setting up `gql.tada/ts-plugin` will start up a [“TypeScript Language Service Plugin”](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin#whats-a-language-service-plugin) when TypeScript is analyzing a file in our IDE or editor. This provides editor hints, such as diagnostics,
auto-completions, and type hovers for GraphQL.

> [!NOTE] VSCode Setup
> There may be extra steps you should take when you're using VSCode.
> [Read about these steps in the "VSCode Setup" section below.](#vscode-settings-and-plugins)

> [!NOTE] Prior to TypeScript 5.5
> There are extra steps you must take when your TypeScript version is older than 5.5.
> [Read about these steps in the "Prior to TypeScript 5.5" section below.](#prior-to-typescript-5-5)

## <span data-step="2">Step 2 —</span> Configuring a schema

We’ll need to set up a GraphQL schema for `gql.tada` to function correctly.
Without a schema, no typings and no editor hints will be available, since the
schema provides the GraphQL types, fields, and description information of
your GraphQL API.

To add a GraphQL schema to `gql.tada`, we'll be the `tsconfig.json`'s plugin
section we've just added and modify the `schema` option.

::: code-group
```json twoslash [tsconfig.json] {6}
{
  "compilerOptions": {
    "plugins": [
      {
// @annotate: Configure your schema here
        "name": "gql.tada/ts-plugin",
        "schema": "./schema.graphql",
        "tadaOutputLocation": "./src/graphql-env.d.ts"
      }
    ]
  }
}
```
:::

The `schema` option currently allows for three different formats to load a schema. It accepts either:

- a path to a `.graphql` file containing a schema definition (in GraphQL SDL format)
- a path to a `.json` file containing a schema’s introspection query data
- a URL to a GraphQL API that can be introspected

::: code-group
```json [.graphql file] {6}
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "gql.tada/ts-plugin",
        "schema": "./schema.graphql"
      }
    ]
  }
}
```

```json [.json file] {6}
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "gql.tada/ts-plugin",
        "schema": "./introspection.json"
      }
    ]
  }
}
```

```json [URL] {6}
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "gql.tada/ts-plugin",
        "schema": "http://localhost:4321/graphql"
      }
    ]
  }
}
```

```json [URL with headers] {6-11}
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "gql.tada/ts-plugin",
        "schema": {
          "url": "http://localhost:4321/graphql",
          "headers": {
            "Accept": "application/graphql-response+json"
          }
        }
      }
    ]
  }
}
```
:::

## <span data-step="3">Step 3 —</span> Configuring typings

We're now ready to let `gql.tada` output a typings file.
This file is generated on the fly by the TypeScript plugin,
and can [also be generated using the CLI](/get-started/workflows#generating-the-output-file).
Where this file will be saved to is configured in the `tsconfig.json` file as
well using the `tadaOutputLocation` option.

::: code-group
```json twoslash [tsconfig.json] {7}
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "gql.tada/ts-plugin",
// @annotate: Configure the output typings file location here
        "schema": "./schema.graphql",
        "tadaOutputLocation": "./src/graphql-env.d.ts"
      }
    ]
  }
}
```
:::

Depeding on the `tadaOutputLocation`'s configured file extension, there's
[two separate formats](/reference/config-format#tadaoutputlocation) this
file can be saved in. For most cases the `.d.ts` format is recommended
for best performance however.

Once we start up our editor, the TypeScript plugin will run and create
the output file. In this example, we’ve created a `src/graphql-env.d.ts` file.
When opening this file we should see code that looks like the following:

::: code-group
```ts [graphql-env.d.ts]
declare const introspection: {
  __schema: { /*...*/ };
};

import * as gqlTada from 'gql.tada';

declare module 'gql.tada' {
  interface setupSchema {
    introspection: typeof introspection;
  }
}
```
:::

The typings file is a representation of an introspected GraphQL schema
and allows types to be inferred for GraphQL documents in the
TypeScript type system. After this file is created by automatically,
`gql.tada` is set up project-wide and is **ready to be used.**

### Initializing `gql.tada` manually

With the prior instructions, we can import `graphql()` from `gql.tada` directly
and start writing GraphQL documents, but this default setup limits what we can do.
In a full setup, we want to customize scalars or pass further type configuration to
`gql.tada`.

To customize `gql.tada`, we’ll create a file that imports the output typings manually
and uses the `initGraphQLTada()` function to create our own `graphql()` function:

:::code-group
```ts twoslash [src/graphql.ts] {4-6}
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql/graphql-env.d.ts';

export const graphql = initGraphQLTada<{
  introspection: introspection;
}>();

export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada';
export { readFragment } from 'gql.tada';
```
:::

This setup is also necessary if we're setting up [multiple schemas](/guides/multiple-schemas)
(for example, in a monorepo), since we'd have multiple output typings files if we're trying
to use `gql.tada` for multiple GraphQL schemas.

Instead of importing `graphql()` from `gql.tada`, we should now import it from our
custom `src/graphql.ts` file.

### Customizing scalar types

Now that we’ve set up a `src/graphql.ts` file, which uses `initGraphQLTada<>()` to create
a custom `graphql` function, we may also use this function to customize our scalars.

By default, `gql.tada` will have types defined for the [built-in scalars](https://spec.graphql.org/October2021/#sec-Scalars.Built-in-Scalars)
in GraphQL. However, it won’t be able to know the serialized type of your custom scalars.
For instance, our schema may contain a `DateTime` scalar which, when queried, becomes
a string of `new Date().toISOString()`, however, `gql.tada` won’t know that this type
is a string.

:::code-group
```ts twoslash [src/graphql.ts] {3-6}
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql/graphql-env.d.ts';

// ---cut-before---
export const graphql = initGraphQLTada<{
// @annotate: Define scalar types here
  introspection: introspection;
  scalars: {
    DateTime: string;
    JSON: any;
  };
}>();
// ---cut-after---

export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada';
export { readFragment } from 'gql.tada';
```
:::

When using these scalars, they’ll now be mapped to the types in the `scalars` object type.

---

## Extra Steps

A few extra steps may be necessary to install and use `gql.tada`.
These are called out, as needed, in the above sections, so you'll only
need to follow these steps depending on your workspace and setup.

### Prior to TypeScript 5.5

If you're using a TypeScript version that's **older** than [TypeScript 5.5](https://devblogs.microsoft.com/typescript/announcing-typescript-5-5/)
you will have to set up the TypeScript plugin differently.

Instead, of using `gql.tada/ts-plugin`, with older versions of TypeScript we'll
install `@0no-co/graphqlsp` directly. This is a package that contains the TypeScript
plugin that `gql.tada/ts-plugin` uses and aliases.

::: code-group

```sh [npm]
npm install --save-dev @0no-co/graphqlsp
```

```sh [pnpm]
pnpm add --save-dev @0no-co/graphqlsp
```

```sh [yarn]
yarn add --dev @0no-co/graphqlsp
```

```sh [bun]
bun add --dev @0no-co/graphqlsp
```

:::

Once `@0no-co/graphqlsp` is installed as a direct dependency, we'll update the `tsconfig.json`
to use it.

::: code-group
```json [tsconfig.json]
{
  "compilerOptions": {
    "strict": true,
    "plugins": [
      {
        "name": "gql.tada/ts-plugin", // [!code --]
        "name": "@0no-co/graphqlsp", // [!code ++]
        "schema": "./schema.graphql",
        "tadaOutputLocation": "./src/graphql-env.d.ts"
      }
    ]
  }
}
```
:::

---

### VSCode Setup

As shown above, `gql.tada` has a TypeScript plugin to provide
editor hints, such as diagnostics, auto-completions, and type hovers
for GraphQL. This plugin will load up when your workspace's
TypeScript installation is used by your editor's TypeScript server.

However, VSCode won't by default load up your workspace's TypeScript
installation and may instead load up a global installation, which
prevents the plugin from being loaded up.

To resolve this, you should create a `.vscode/settings.json` file to prompt you
[to use the workspace version of TypeScript](https://code.visualstudio.com/docs/typescript/typescript-compiling#_using-the-workspace-version-of-typescript).

::: code-group
```js [.vscode/settings.json] {2-3}
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```
:::

To enable syntax highlighting for GraphQL, you can install the official
[“GraphQL: Syntax Highlighting” VSCode extension.](https://marketplace.visualstudio.com/items?itemName=GraphQL.vscode-graphql-syntax)

---

### Vue and Svelte Support

If you're using Vue's `.vue` files and Svelte's `.svelte` files, the
TypeScript plugin won't be able to run in your editor under normal
circumstances.
While some implementations exist for TypeScript to run and type
check Vue and Svelte files, `gql.tada` won't have any output in
these cases.

However, while the TypeScript plugin may not support `.vue` and
`.svelte` files, [the `gql-tada check` command does.](/get-started/workflows#running-diagnostics)
To enable support for either files, you'll need to install the
corresponding support packages.

::: code-group
```sh [npm]
# for Vue
npm install -D @gql.tada/vue-support
# for Svelte
npm install -D @gql.tada/svelte-support
```

```sh [pnpm]
# for Vue
pnpm add -D @gql.tada/vue-support
# for Svelte
pnpm add -D @gql.tada/svelte-support
```

```sh [yarn]
# for Vue
yarn add -D @gql.tada/vue-support
# for Svelte
yarn add -D @gql.tada/svelte-support
```

```sh [bun]
# for Vue
bun add -d @gql.tada/vue-support
# for Svelte
bun add -d @gql.tada/svelte-support
```
:::

Once these are installed, the CLI's `check` and other commands will
be able to parse and check external files for `gql.tada` errors.

<a href="/get-started/workflows" class="button">
  Learn more about using the CLI
</a>
