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
| `intellisense` | Experimental. Lowers selections so TypeScript completes and checks field names. |

Content mappers run external code, so TypeScript only starts them when we opt in,
with `tsc --runExternalCode` or the language server's
`initializationOptions.runExternalCode`.

The mapper also maps our schema file, so we don't need to generate an introspection
output file. See [Schemas](#schemas) below.

## Documents

- Named operations and fragments are exported under their names. A lone anonymous
  operation becomes the default export.
- Fragment spreads are passed to `graphql()` as fragment dependencies, so
  [fragment masking](/guides/fragment-colocation) works as it does in `.ts` files.
- Definitions named after reserved words (e.g. `query delete`) are still exported
  under their GraphQL names.
- Files that only contain schema definitions become empty modules, unless they're
  our schema.

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

With a single `.graphql` schema, documents are also validated against it. Unknown
fields and variables of the wrong type are reported where they're written, and
documents are re-checked when the schema file changes.

::: warning
TypeScript doesn't know yet that these are type errors. On the command line, `tsc`
hides the project's other type errors while a `.graphql` file has a validation
error. Inline `graphql()` calls in `.ts` files aren't validated on TypeScript 7.
:::

## Schemas

The mapper reads the schema from the `gql.tada` / GraphQLSP plugin config in our
`tsconfig.json`, including configs it `extends`. The schema file needs to be part of
the program, e.g. through `include`.

::: code-group
```json [tsconfig.json]
{
  "compilerOptions": {
    "plugins": [ // [!code focus:6]
      {
        "name": "gql.tada/ts-plugin",
        "schema": "./schema.graphql"
      }
    ]
  },
  "include": ["src", "schema.graphql"], // [!code focus]
  "contentMappers": [
    {
      "package": "@gql.tada/content-mapper",
      "extensions": [".graphql"],
      "options": { "module": "./src/graphql.js" }
    }
  ]
}
```
:::

The schema module exports the same `introspection` type as a generated
`graphql-env.d.ts` file:

::: code-group
```ts [src/graphql.ts]
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from '../schema.graphql';

export const graphql = initGraphQLTada<{
  introspection: introspection;
}>();
```
:::

A single schema also sets up `gql.tada`'s default `graphql` export, like a generated
file does. With [multiple schemas](/guides/multiple-schemas), each schema file only
exports its `introspection` type.

- Mapped schemas need `graphql` to be installed.
- URL schemas aren't mapped. Keep generating output files for them with
  `gql.tada generate output`.
- Without a plugin config, a `.graphql` file that defines a `Query` type or a `schema`
  definition is mapped as a schema.

### JSON introspection schemas

TypeScript doesn't let content mappers handle `.json` files, so a `.json` schema from
our plugin config is mapped through a `.graphql` file that only imports it:

::: code-group
```graphql [src/schema.graphql]
# import * from "../schema.json"
```
```ts [src/graphql.ts]
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './schema.graphql';

export const graphql = initGraphQLTada<{
  introspection: introspection;
}>();
```
:::

This module is the same as the schema module of a `.graphql` schema, and documents
are validated against the JSON schema too. Other `.json` imports are unaffected.

::: info
- Import `introspection` from the `.graphql` file. Importing the `.json` file directly
  still gives a plain JSON module.
- Only `.json` files configured as a `schema` can be imported this way.
- The JSON file is read from disk, so unsaved changes in the editor aren't picked up.
:::

## Field IntelliSense (experimental)

With `"intellisense": true` in the mapper's `options`, TypeScript itself offers
completions, hover information and go-to-definition on field names and type conditions
in `.graphql` documents, and reports unknown fields and types on them:

```json
"options": { "module": "./src/graphql.ts", "intellisense": true }
```

The mapper lowers every selection set to type-only declarations typed by our
`graphql()` function's schema, e.g. `declare const $1: $Of<typeof $0.pokemons>;`, and
maps each field name onto its GraphQL token. These declarations are erased from emitted
output.

::: info
- When documents are also validated against a configured schema, TypeScript's errors on
  these declarations are dropped, since validation reports the same errors with GraphQL's
  messages.
- Completions are only offered on a name that's being typed, not on an empty line.
- Go-to-definition jumps to the field in the introspection type, which is only a useful
  location for generated `graphql-env.d.ts` output, not for mapped `.graphql` schemas.
:::

## Runtime

TypeScript never emits JavaScript for `.graphql` files, so our bundler has to load
them. The package's `transform` export returns the same module TypeScript sees, and
`resolveGraphQLModule(configFileName, fileName, module)` turns the
`tsconfig.json`-relative `module` option into a specifier relative to each file.
For example, with Vite:

::: code-group
```ts [vite.config.ts]
import * as path from 'node:path';
import { defineConfig, transformWithEsbuild } from 'vite';
import { resolveGraphQLModule, transform } from '@gql.tada/content-mapper';

const tsconfig = path.resolve(__dirname, 'tsconfig.json');

export default defineConfig({
  plugins: [
    {
      name: 'graphql-files',
      async transform(source, id) {
        if (!id.endsWith('.graphql')) return;
        const { text } = transform(source, {
          fileName: id,
          // Your `module` option, as your bundler resolves it. Vite only maps
          // `.js` to `.ts` in TypeScript files, so leave out the extension
          graphqlModule: resolveGraphQLModule(tsconfig, id, './src/graphql'),
        });
        return transformWithEsbuild(text, `${id}.ts`, { loader: 'ts' });
      },
    },
  ],
});
```
:::

`graphqlExport` sets the export name of the `graphql()` function (defaults to `"graphql"`).
