---
title: GraphQL Files
description: Import .graphql files as typed documents with TypeScript 7.1
---

# GraphQL Files <Badge type="warning" text="Experimental" />

<section>
  On TypeScript 7.1 and later, <code>@gql.tada/content-mapper</code>
  lets us import <code>.graphql</code> files as typed
  <code>gql.tada</code> documents.
</section>

Every operation and fragment in a `.graphql` file becomes a named export, typed by
our own `graphql()` function, as if we had written it in a `.ts` file.

::: code-group
```graphql [src/pokemons.graphql]
# import PokemonItem from "./PokemonItem.graphql"

query Pokemons($limit: Int = 10) {
  pokemons(limit: $limit) {
    ...PokemonItem
  }
}
```

```ts [src/index.ts]
import type { ResultOf, VariablesOf } from 'gql.tada';
import { Pokemons } from './pokemons.graphql';

type Data = ResultOf<typeof Pokemons>;
type Variables = VariablesOf<typeof Pokemons>;
```
:::

::: warning
Content mappers are new in TypeScript 7.1 and the protocol may still change before
7.1 is stable.
:::

---

## Setup

Install the mapper next to `typescript@>=7.1`:

::: code-group
```sh [npm]
npm install --save-dev @gql.tada/content-mapper
```
```sh [pnpm]
pnpm add --save-dev @gql.tada/content-mapper
```
```sh [yarn]
yarn add --dev @gql.tada/content-mapper
```
:::

Register it for `.graphql` files in `tsconfig.json` and point `module` at the module
that exports our `graphql()` function. Relative paths resolve against the
`tsconfig.json`'s directory, and should be written the way our `moduleResolution`
expects imports to be written.

::: code-group
```json [tsconfig.json]
{
  "compilerOptions": {
    "module": "nodenext"
  },
  "contentMappers": [ // [!code focus:7]
    {
      "package": "@gql.tada/content-mapper",
      "extensions": [".graphql"],
      "options": { "module": "./src/graphql.js" }
    }
  ]
}
```
:::

| Option   | Description                                                        |
| -------- | ------------------------------------------------------------------ |
| `module` | Module specifier of the `graphql()` function. Required.            |
| `export` | Export name of the `graphql()` function. Defaults to `"graphql"`.  |

Content mappers run external code, so TypeScript only starts them when we opt in,
with `tsc --runExternalCode` or the language server's
`initializationOptions.runExternalCode`.

The mapper doesn't produce our schema's types. Keep generating the introspection
output file with `gql.tada generate output`, as described on the
[Essential Workflows page](/get-started/workflows).

## Documents

- Named operations and fragments are exported under their names. A lone anonymous
  operation becomes the default export.
- Fragment spreads are passed to `graphql()` as fragment dependencies, so
  [fragment masking](/guides/fragment-colocation) works as it does in `.ts` files.
- Definitions named after reserved words (e.g. `query delete`) are still exported
  under their GraphQL names.
- Files that only contain schema definitions become empty modules.

Fragments from other files are imported with comments at the top of a document:

```graphql
# import PokemonItem, PokemonStats from "./fragments.graphql"
# import * from "./more-fragments.graphql"
```

Named imports only import the listed fragments. Wildcard imports resolve any spread
fragment that isn't defined in the current file.

The mapper reports syntax errors, unknown fragments, duplicate names, anonymous
operations next to other definitions, and fragment cycles. Type errors, hovers and
go-to-definition in the generated code are mapped back to the `.graphql` source.

::: info
Documents in `.graphql` files aren't validated against the schema yet. An unknown
field is not an error, it's only missing from the result type.
:::

## Runtime

TypeScript never emits JavaScript for `.graphql` files, so our bundler has to load
them. The package's `transform` export returns the same module TypeScript sees and
can be used in a bundler plugin:

```ts
import { transform } from '@gql.tada/content-mapper';

const { text } = transform(source, {
  fileName,
  graphqlModule: '../graphql',
});
```

`graphqlExport` sets the export name (defaults to `"graphql"`). To reuse the
`tsconfig.json`-relative `module` option, `resolveGraphQLModule(configFileName,
fileName, module)` turns it into a specifier relative to `fileName`.
