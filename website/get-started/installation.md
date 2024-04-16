---
title: Installation
description: How to get set up and ready
---

# Installation

The `gql.tada` package provides typings and the runtime API as a library,
while `@0no-co/graphqlsp` integrates with the TypeScript language server
to integrate with an IDE or editor.

On this page, we’ll go through the steps to get everything set up properly.
A quick demo of what this looks like can be found [in an example project in the `gql.tada`
repository.](https://github.com/0no-co/gql.tada/blob/main/examples/example-pokemon-api/)

## <span data-step="1">Step 1 —</span> Installing packages

We’ll start by installing `gql.tada` as a dependency, and `@0no-co/graphqlsp` as
a dev-dependency using out project’s package manager.

::: code-group

```sh [npm]
npm install gql.tada
npm install --save-dev @0no-co/graphqlsp
```

```sh [pnpm]
pnpm add gql.tada
pnpm add --save-dev @0no-co/graphqlsp
```

```sh [yarn]
yarn add gql.tada
yarn add --dev @0no-co/graphqlsp
```

```sh [bun]
bun add gql.tada
bun add --dev @0no-co/graphqlsp
```

:::

Next, we’ll have to add `@0no-co/graphqlsp` as a plugin to our TypeScript
configuration.

::: code-group

```json [tsconfig.json]
{
  "compilerOptions": {
    "strict": true,
    "plugins": [ // [!code ++]
      { // [!code ++]
        "name": "@0no-co/graphqlsp", // [!code ++]
        "schema": "./schema.graphql", // [!code ++]
        "tadaOutputLocation": "./src/graphql-env.d.ts" // [!code ++]
      } // [!code ++]
    ] // [!code ++]
  }
}
```

:::

This will start up a [“TypeScript Language Service Plugin”](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin#whats-a-language-service-plugin) which runs when TypeScript is analyzing a file
in our IDE or editor.

`gql.tada` on its own won’t provide you with editor hints, diagnostics, or errors, so `@0no-co/graphqlsp` is crucial
in providing you feedback and help when writing GraphQL documents.

> [!NOTE]
> If you’re using VSCode, you may also want to update your `.vscode/settings.json` file to prompt you
> [to use the workspace version of TypeScript](https://code.visualstudio.com/docs/typescript/typescript-compiling#_using-the-workspace-version-of-typescript).
> Otherwise, the `@0no-co/graphqlsp` plugin won’t work!
>
> ::: code-group
>
> ```js [.vscode/settings.json] {2-3}
> {
>   "typescript.tsdk": "node_modules/typescript/lib",
>   "typescript.enablePromptUseWorkspaceTsdk": true
> }
> ```
>
> :::
>
> To enable syntax highlighting for GraphQL, you can install the official
> [“GraphQL: Syntax Highlighting” VSCode extension.](https://marketplace.visualstudio.com/items?itemName=GraphQL.vscode-graphql-syntax)

## <span data-step="2">Step 2 —</span> Configuring a schema

`@0no-co/graphqlsp` needs to have a GraphQL API’s schema to function correctly.
The schema provides it with the types, fields, and description information of a GraphQL API.

We can set `@0no-co/graphqlsp` up with our schema in our `tsconfig.json` file.
In the plugin options we’ll update the `schema` key.

::: code-group
```json twoslash [tsconfig.json] {6-7}
{
  "compilerOptions": {
    "plugins": [
      {
// @annotate: Configure your schema here
        "name": "@0no-co/graphqlsp",
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
        "name": "@0no-co/graphqlsp",
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
        "name": "@0no-co/graphqlsp",
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
        "name": "@0no-co/graphqlsp",
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
        "name": "@0no-co/graphqlsp",
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

Afterwards, `@0no-co/graphqlsp` is ready to also output a typings file for `gql.tada`.
The latter needs a **type** of an introspected GraphQL schema to infer types of
GraphQL documents automatically.

This is configured by providing an output location to `@0no-co/graphqlsp` in our `tsconfig.json` file.
In the plugin options we’ll update the `tadaOutputLocation` key.

::: code-group
```json twoslash [tsconfig.json] {6-7}
{
  "compilerOptions": {
    "plugins": [
      {
// @annotate: Configure your schema here
        "name": "@0no-co/graphqlsp",
        "schema": "./schema.graphql",
        "tadaOutputLocation": "./src/graphql-env.d.ts"
      }
    ]
  }
}
```
:::

The `tadaOutputLocation` path can either be a `.ts` file, a `.d.ts` file, or
a folder, in which case a `introspection.d.ts` file will be created.

Once we start up our editor, `@0no-co/graphqlsp` will run and will create
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

This file declares our schema’s introspection data in `gql.tada`. After this file
is created by `@0no-co/graphqlsp` automatically, `gql.tada` is set up project-wide
and is **ready to be used.**

### Initializing `gql.tada` manually

Above, we let `@0no-co/graphqlsp` generate a `src/graphql-env.d.ts` file, which sets
`gql.tada` up project-wide for us.

This allows us to import `graphql()` from `gql.tada` directly, but it limits what we
can do, since we can’t customize any scalars, or further configuration
for `gql.tada`. This setup also fails if we have multiple schemas (for example, in a monorepo),
since the declaration in `graphql-env.d.ts` sets a schema up project-wide.

To work around this, we’ll create a file that uses the introspection data manually with the
`initGraphQLTada()` function to create our own `graphql()` function:

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

Instead of declaring our schema project-wide, we now have created a `graphql` function
that specifically uses the introspection inside the `graphql-env.d.ts` file that
`@0no-co/graphqlsp` outputs for us.

Instead of importing `graphql` from `gql.tada`, we should now import it from our
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
