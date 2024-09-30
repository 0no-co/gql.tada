---
title: Configuration Format
---

# Configuration Format

Both `gql.tada`'s [CLI](/reference/gql-tada-cli) as well as the TypeScript
plugin are configured using an entry in your `tsconfig.json` file.
Their configurations are part of the TypeScript plugin entry:

::: code-group
```json [tsconfig.json] {4-10}
{
  "compilerOptions": {
    "strict": true,
    "plugins": [
      {
        "name": "gql.tada/ts-plugin",
        "schema": "./schema.graphql",
        "tadaOutputLocation": "./src/graphql-env.d.ts"
      }
    ]
  }
}
```
:::

The section marked containing `schema` is what you can populate with [**Schema Options**](#schema-options),
as described in the next section. This will set up a default schema for `gql.tada`
to use and the only required options are [`schema`](#schema) and [`tadaOutputLocation`](#tadaoutputlocation).

If you have multiple schemas you'd like to use with `gql.tada`, then you'll instead want
to create a `schemas` array.

::: code-group
```json [tsconfig.json] {7-12}
{
  "compilerOptions": {
    "strict": true,
    "plugins": [
      {
        "name": "gql.tada/ts-plugin",
        "schemas": [
          {
            "name": "your-schema-1",
            "schema": "./schema-1.graphql",
            "tadaOutputLocation": "./src/graphql-env-1.d.ts"
          },
          {
            "name": "your-schema-2",
            "schema": "./schema-2.graphql",
            "tadaOutputLocation": "./src/graphql-env-2.d.ts"
          }
        ]
      }
    ]
  }
}
```
:::

The `name` property in each `schemas[]` entry is arbitrary. It's important that you give each of your
schemas a name here, but this can be any name you want and is only used to identify the schema internally
and to you in error messages.

::: info Optional Schema Options
Don't worry about setting up more than the required `schema` and `tadaOutputLocation` configuration option.

All optional schema options are mostly used by the `gql.tada` CLI, which will tell you if you're missing
any of the extra configuration options. Additionally, to validate your configuration, you can always
run the [`gql.tada doctor` CLI command](/reference/gql-tada-cli#doctor).
:::

## Schema Options

This section documents all of the schema-specific configuration options.
These options are specific to a single schema and are added either under
the main plugin config or inside the `schemas[]` array items.

### `schema` <Badge type="danger" text="required" />

The `schema` option specifies how to load your GraphQL schema and currently allows
for three different schema formats. It accepts either:

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

Since this option defines which GraphQL schema is used, it's required
and both the CLI and the TypeScript plugin will not function without it.

<a href="../get-started/installation#step-2-configuring-a-schema" class="button">
  <h4>Installation</h4>
  <p>
    Learn how to configure the <code>schema</code> option
  </p>
</a>

---

### `tadaOutputLocation` <Badge type="danger" text="required" />

The `tadaOutputLocation` specifies the output path to write a typings
output file to, which `gql.tada` uses to infer GraphQL types within
the TypeScript type system.

The `tadaOutputLocation` option supports two different formats dependent on the
file path you pass: the `.d.ts` format, and the `.ts` format.
Depending on the file path's extension, either of these output
formats are used.

When the option only specifies a directory, a `introspection.d.ts` file
will automatically be written to the output directory.

#### Format 1 — `.d.ts` file

The `.d.ts` output format is only a declaration file, which will also contain a
declaration that automatically declares [a `setupSchema` interface on `gql.tada`](./gql-tada-api#setupschema).
When this format is used, [declaration merging in TypeScript](https://www.typescriptlang.org/docs/handbook/declaration-merging.html),
kicks in, which means that - without any additional configuration - we can then start
importing `graphql()` from `gql.tada` and use it.

The resulting file will have the following shape:

::: code-group
```ts [graphql-env.d.ts]
export type introspection = {
  __schema: { /*...*/ };
};

import * as gqlTada from 'gql.tada';

declare module 'gql.tada' {
  interface setupSchema {
    introspection: introspection;
  }
}
```
:::

If we want to now customize `gql.tada`, for instance to set up our scalar types, we’ll need to
create our own `graphql()` function by importing the output typings manually and passing it
to [`gql.tada`’s `initGraphQLTada<>()` function](./gql-tada-api#initgraphqltada):

::: code-group
```ts [graphql.ts]
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql-env.d.ts';

export const graphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    DateTime: string;
    JSON: any;
  };
}>();
```
:::

Since this is just a declaration file, the easiest way to indicate this in our code is to
use a `import type` statement and to refer to the file using its full file extension.

#### Format 2 — `.ts` file

> [!WARNING] A note on performance
>
> We strongly recommend you to use the `.d.ts` format instead. While it's less reusable, the format will
> be more efficient and increase TypeScript inference performance.

When writing a `.ts` file instead, a regular TypeScript file will be created exporting
an `introspection` object. This format is supported because, while this object may cause
a large increase in bundlesize, occasionally other tools may also depend on the raw GraphQL
introspection output during runtime.

The resulting file will have the following shape:

::: code-group
```ts [introspection.ts]
const introspection = {
  __schema: { /*...*/ },
} as const;

export { introspection };
```
:::

Because this file doesn't include a `declare module` typings directive, with this format
we're always required to set up `gql.tada` manually using the
[`initGraphQLTada<>()` function](./gql-tada-api#initgraphqltada).

<a href="../get-started/installation#initializing-gqltada-manually" class="button">
  <h4>Installation</h4>
  <p>
    Learn how to configure the <code>tadaOutputLocation</code> option
  </p>
</a>

---

### `tadaTurboLocation`

The `tadaOutputLocation` specifies the output path that the
[`gql.tada turbo`](/reference/gql-tada-cli#turbo) command will write
the type cache output file to.

Type cache files are `.d.ts` files that cache `gql.tada`'s inferred types
This means that when you run `gql.tada turbo` after making your changes,
TypeScript will be able to start up and type check your GraphQL documents
much more quickly than without the type cache.

<a href="/reference/gql-tada-cli#turbo" class="button">
  <h4>CLI Reference</h4>
  <p>
    Learn more about the <code>gql.tada turbo</code> command.
  </p>
</a>

---

### `tadaPersistedLocation`

The `tadaPersistedLocation` specifies the output path that the
[`gql.tada generate persisted`](/reference/gql-tada-cli#generate-persisted)
command will write the persisted JSON manifest file to.

Persisted manifest files are `.json` files that contain all GraphQL
documents referenced using a [`graphql.persisted` call](/reference/gql-tada-api#graphql-persisted).
This is useful to implement persisted operations, as all documents will
be extracted into the manifest file at compile-time.

<div class="column">
  <a href="/reference/gql-tada-api#graphql-persisted" class="button">
    <h4>API Reference</h4>
    <p>
      Learn more about the <code>graphql.persisted()</code> API.
    </p>
  </a>

  <a href="/reference/gql-tada-cli#generate-persisted" class="button">
    <h4>CLI Reference</h4>
    <p>
      Learn more about the <code>gql.tada generate persisted</code> command.
    </p>
  </a>
</div>

---

## Global Options

This section documents all of the plugin-wide configuration options.
These options aren't specific to a single schema and configure both
global features for the `gql.tada` CLI and the TypeScript plugin.

### `trackFieldUsage`

::: code-group
```json [tsconfig.json]
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "gql.tada/ts-plugin",
        "schema": "./schema.graphql",
        "tadaOutputLocation": "./src/graphql-env.d.ts",
        "trackFieldUsage": true // [!code ++]
      }
    ]
  }
}
```
:::

By default, this option is enabled. When enabled, your usage of
fields will be tracked as you consume data typed using a GraphQL document.

The TypeScript plugin and the [`gql.tada check` command](/reference/gql-tada-cli#check)
will run a diagnostic that issues warnings when any fields in your selection
sets aren't used in your TypeScript code.

```tsx twoslash {8}
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { FragmentOf, graphql, readFragment } from 'gql.tada';

// @warn: GraphQLSP: Field 'maxHP is not used.

export const PokemonItemFragment = graphql(`
  fragment PokemonItem on Pokemon {
    id
    name
    maxHP
  }
`);

interface Props {
  data: FragmentOf<typeof PokemonItemFragment>;
}

export const PokemonItem = ({ data }: Props) => {
  const pokemon = readFragment(PokemonItemFragment, data);
  return <li></li>;
};
```

In the above example, we add a `maxHP` field to a fragment that the component’s
code does not actually access, which causes a warning to be displayed.

::: info When should `trackFieldUsage` be disabled?
Usage of any fields is based on heuristics. As such, depending on your coding
patterns this warning can sometimes be triggered erroneously and support of
more coding patterns is still being expanded.

If you see any false-positive warnings, feel free to disable `trackFieldUsage`
or report the problematic code pattern to us in an issue.
:::

---

### `shouldCheckForColocatedFragments`

::: code-group
```json [tsconfig.json]
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "gql.tada/ts-plugin",
        "schema": "./schema.graphql",
        "tadaOutputLocation": "./src/graphql-env.d.ts",
        "shouldCheckForColocatedFragments": true // [!code ++]
      }
    ]
  }
}
```
:::

By default, this option is enabled. When enabled, your imports will be scanned
for exported fragments.

The TypeScript plugin and the [`gql.tada check` command](/reference/gql-tada-cli#check)
will issue warnings when you're missing imports to a GraphQL fragment exported by
will run a diagnostic that issues warnings when any imports statements don't import
a GraphQL fragment exported by another module.<br />
This is important to help with [fragment co-location](/guides/fragment-colocation)
as many component modules may export fragments that you should be importing and
use in the importer's GraphQL documents.

```tsx twoslash {4}
import './graphql/graphql-env.d.ts';
// ---cut-before---
// @filename: ./src/PokemonItem.tsx
export const PokemonItem = () => null;
// @filename: ./src/PokemonsList.tsx
// ---cut---
import { useQuery } from 'urql';
import { graphql } from 'gql.tada';

// @warn: GraphQLSP: Unused co-located fragment definition(s)
import { PokemonItem } from './PokemonItem';

const PokemonsQuery = graphql(`
  query Pokemons($limit: Int = 10) {
    pokemons(limit: $limit) {
      id
      name
    }
  }
`, []);

export const PokemonList = () => {
  const [result] = useQuery({ query: PokemonsQuery });
  return null; // ...
};
```

In the above example, we add an import to a `PokemonItem` component.
If the file contains a fragment that we have to use in our query a warning is displayed.

::: info When should `shouldCheckForColocatedFragments` be disabled?
This warning is context-sensitive. It can be very helpful when you're
following our recommended [fragment co-location patterns](/guides/fragment-colocation).
However, if you're not using co-located fragments, or if you have many "mixed"
files that contain both components with fragments and other code, this warning
can get confusing and annoying.

We recommend you to disable this check if you know that you're not
going to follow [fragment co-location](/guides/fragment-colocation).
:::
