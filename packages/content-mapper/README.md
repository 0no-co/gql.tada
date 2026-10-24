# @gql.tada/content-mapper

**`@gql.tada/content-mapper`** is a [TypeScript 7.1+ content mapper](https://github.com/microsoft/TypeScript/issues/63703)
that lets you import `.graphql` files as typed `gql.tada` documents.

Every operation and fragment in a `.graphql` file becomes a named export, typed by
your own `graphql()` function, as if you had written it in a `.ts` file:

```graphql
# src/pokemons.graphql
# import PokemonItem from "./PokemonItem.graphql"

query Pokemons($limit: Int = 10) {
  pokemons(limit: $limit) {
    ...PokemonItem
  }
}
```

```ts
import type { ResultOf } from 'gql.tada';
import { Pokemons } from './pokemons.graphql';

type Data = ResultOf<typeof Pokemons>;
```

## Setup

Install the package next to `typescript@>=7.1` and `gql.tada`:

```sh
npm install --save-dev @gql.tada/content-mapper
```

Register it for `.graphql` files in your `tsconfig.json` and point the `module`
option at the module exporting your `graphql()` function. Relative paths resolve
against the `tsconfig.json`'s directory. Write the path the way your
`moduleResolution` setting expects imports to be written.

```json
{
  "compilerOptions": {
    "module": "nodenext"
  },
  "contentMappers": [
    {
      "package": "@gql.tada/content-mapper",
      "extensions": [".graphql"],
      "options": { "module": "./src/graphql.js" }
    }
  ]
}
```

| Option   | Description                                                        |
| -------- | ------------------------------------------------------------------ |
| `module` | Module specifier of your `graphql()` function. Required.           |
| `export` | Export name of your `graphql()` function. Defaults to `"graphql"`. |

Content mappers run external code, so TypeScript only starts them when you opt in:

- `tsc --runExternalCode` on the command line
- `initializationOptions.runExternalCode` for the language server

## Documents

- Named operations and fragments are exported under their names. A lone anonymous
  operation becomes the default export.
- Fragment spreads are passed to `graphql()` as fragment dependencies, so fragment
  masking and `readFragment()` behave the same as in `.ts` files.
- Definitions named after reserved words (e.g. `query delete`) are still exported
  under their GraphQL names.
- Files that only contain schema definitions (SDL) become empty modules, unless
  they're your schema (see [Schemas](#schemas)).

Fragments from other files are imported with comments at the top level of a document:

```graphql
# import PokemonItem, PokemonStats from "./fragments.graphql"
# import * from "./more-fragments.graphql"
#import "./even-more-fragments.graphql"
```

Named imports only import the listed fragments. Wildcard imports (`*`, or the
`graphql-tag/loader` form without names) resolve any spread fragment that isn't
defined in the current file.

The mapper reports GraphQL syntax errors, unknown fragments, duplicate definition
names, and fragment cycles. Type errors from the generated code, such as an imported
fragment that doesn't exist, are reported on the original GraphQL source.

When the project has a single SDL schema (see below), documents are also validated
against it, e.g. unknown fields or variables of the wrong type are reported where
they're written. Validation reads the schema from disk, and TypeScript re-checks your
documents when it changes.

## Schemas

The mapper also maps your `.graphql` schema file, so you don't need to generate an
introspection output file (`tadaOutputLocation`) with `gql.tada generate output` or
GraphQLSP. It reads the schema from the GraphQLSP / `gql.tada` plugin config in your
`tsconfig.json` (TypeScript 7 doesn't pass it to mappers), including configs it
`extends`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@0no-co/graphqlsp",
        "schema": "./schema.graphql",
        "tadaOutputLocation": "./src/graphql-env.d.ts"
      }
    ]
  },
  "include": ["src", "schema.graphql"],
  "contentMappers": [
    {
      "package": "@gql.tada/content-mapper",
      "extensions": [".graphql"],
      "options": { "module": "./src/graphql.js" }
    }
  ]
}
```

The schema module exports the same `introspection` type as a generated
`graphql-env.d.ts` file. Import it to create your `graphql()` function:

```ts
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from '../schema.graphql';

export const graphql = initGraphQLTada<{ introspection: introspection }>();
```

Like a generated file, a single schema also sets up `gql.tada`'s default `graphql`
export, as long as the schema file is part of your program (e.g. through `include`).
In multi-schema setups (`schemas` with a `name` each), every schema file only exports
its `introspection` type. Mapped schemas need `graphql` to be installed. URL schemas
aren't mapped, so keep generating output files for them.

TypeScript doesn't let content mappers handle `.json` files, so a `.json` introspection
schema from the plugin config is mapped through a `.graphql` file that only imports it,
and which you import the `introspection` type from instead:

```graphql
# src/schema.graphql
# import * from "../schema.json"
```

Without a plugin config, a `.graphql` file that defines a `Query` type or a `schema`
definition is mapped as a schema, which only exports its `introspection` type.
Schema syntax and validation errors are reported on the schema file.

## Runtime

TypeScript only type-checks `.graphql` files and never emits JavaScript for them, so
your bundler needs to load them at runtime. The `transform` export of this package
returns the same TypeScript module that TypeScript sees, which can be used in a
bundler plugin:

```ts
import { transform } from '@gql.tada/content-mapper';

const { text } = transform(source, {
  fileName,
  graphqlModule: '../graphql',
});
```
