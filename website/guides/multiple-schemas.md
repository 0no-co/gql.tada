---
title: Multiple Schemas
description: How to set up multiple schemas and GraphQL APIs
---

# Multiple Schemas <Badge text="v1.6" />

<section>
  If we're interacting with multiple GraphQL APIs in a one
  codebase, we can set <code>gql.tada</code> up to support
  multiple schemas at a time.
</section>

When first getting started you're probably setting up `gql.tada`
for a single schema - your own GraphQL API's schema. However,
once you're interacting with another GraphQL API you can set up
`gql.tada` for it as well.

::: details When would you setup multiple schemas?
  Interacting with multiple GraphQL APIs isn't uncommon anymore.

  - Maybe you have a public GraphQL API and a private, admin GraphQL API?
  - Maybe you're in a monorepo and your GraphQL API is calling another
    third-party GraphQL API?

  While consuming multiple GraphQL APIs on your front-end
  simultaneously makes you lose out of a lot of GraphQL's benefits,
  there are still many reasons for a your codebase to communicate
  with multiple GraphQL APIs.

  Whenever you're writing GraphQL documents for different schemas,
  you'll probably want to set them up with `gql.tada` to rely
  on its types and diagnostics.
:::

---

## <span data-step="1">1.</span> Configuring Multiple Schemas

If you've followed the instructions on the [Installation page](/get-started/installation#step-2-—-configuring-a-schema),
your configuration contains only one set of [schema options](/reference/config-format#schema-options)
in the plugin configuration.

To add multiple schemas, you'll have to update your configuration and move
all schema options onto a `schemas[]` array.

::: code-group
```json [tsconfig.json]
{
  "compilerOptions": {
    "plugins": [
      { // [!code focus:15]
        "name": "gql.tada/ts-plugin",
        "schemas": [
          {
            "name": "pokemon",
            "schema": "./graphql/pokemon.graphql",
            "tadaOutputLocation": "./src/graphql/pokemon-env.d.ts"
          },
          {
            "name": "simple",
            "schema": "./graphql/simple.graphql",
            "tadaOutputLocation": "./src/graphql/simple-env.d.ts"
          }
        ]
      }
    ]
  }
}
```
:::

All entries in the `schemas[]` list are entirely separate and load their
own GraphQL schemas and have their own file locations.

You'll have to add a unique `name` to each entry. These names are only
used in `gql.tada`'s internal tooling, and in errors and
diagnostics messages, so they're entirely arbitrary.

<a href="/reference/config-format#schema-options" class="button">
  <h3>Config Format</h3>
  <p>Learn more about available Schema Options</p>
</a>

After you've updated your configuration you can use the `doctor`
command to make sure everything's working properly.

```sh
gql.tada doctor
```

## <span data-step="2">2.</span> Initializing `gql.tada` per schema

<section>
  For each schema, we'll need to initialize an individual <code>graphql()</code>
  function for types and diagnostics to work properly.
</section>

Once multiple schemas are configured, we cannot import and use the `graphql()`
function from `gql.tada` anymore and have to instead create a `graphql()` function
per schema manually.

This is because the GraphQL schema types are different
for each schema we've set up, and `gql.tada`'s tooling also needs to be able
to identify each schema per document.

::: info Installation Steps
For this section, you'll basically repeating the steps from
[the Installation page's "Intializing `gql.tada` manually" section](/get-started/installation#initializing-gql-tada-manually)
for each schema you're setting up.
:::

To do this, we'll call `initGraphQLTada()` to create a new `graphql()` function
for each schema we're setting up.

:::code-group
```ts twoslash [src/graphql/pokemon.ts] {2}
// @filename: pokemon-env.d.ts
export type introspection = import('./graphql/graphql-env.d.ts').introspection;
// @filename: index.ts
// ---cut---
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './pokemon-env.d.ts';

export const graphql = initGraphQLTada<{
  introspection: introspection;
}>();
```
:::

We'll have to repeat this for each schema we're setting up. For our prior example,
we'd be repeating this for our `simple.graphql` schema.

:::code-group
```ts twoslash [src/graphql/simple.ts] {2}
// @filename: simple-env.d.ts
export type introspection = {
  name: 'simple';
  query: 'Query';
  types: {
    String: unknown;
    Query: {
      kind: 'OBJECT';
      name: 'Query';
      fields: {
        helloWorld: {
          name: 'helloWorld';
          type: {
            kind: 'SCALAR';
            name: 'String';
            ofType: null;
          };
        };
      };
    };
  };
};
// @filename: index.ts
// ---cut---
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './simple-env.d.ts';

export const graphql = initGraphQLTada<{
  introspection: introspection;
}>();
```
:::

After setting up each schema, each individual `graphql()` function imported
from these new files will point to a different schema and infer to the
corresponding types.

```ts twoslash [src/graphql/simple.ts]
// @filename: src/graphql/simple-env.d.ts
export type introspection = {
  name: 'simple';
  query: 'Query';
  types: {
    String: unknown;
    Query: {
      kind: 'OBJECT';
      name: 'Query';
      fields: {
        helloWorld: {
          name: 'helloWorld';
          type: {
            kind: 'SCALAR';
            name: 'String';
            ofType: null;
          };
        };
      };
    };
  };
};
// @filename: src/graphql/simple.ts
// ---cut---
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './simple-env.d.ts';

export const graphql = initGraphQLTada<{
  introspection: introspection;
}>();
// @filename: src/index.ts
// ---cut---
import { graphql } from './graphql/simple';

const query = graphql(`
  { helloWorld }
`);
```

<a href="/reference/gql-tada-api#initgraphqltada" class="button">
  <h3>API Reference</h3>
  <p>Learn more about the <code>initGraphQLTada()</code> function</p>
</a>

---

### CLI Commands

```sh
gql.tada check
gql.tada generate output
gql.tada generate turbo
gql.tada generate persisted
```

All of the `gql.tada` CLI's commands still work the exact same
when multiple schemas are set up.

However, while all `generate` commands accept an `--output` argument when
only one schema is configured, with multiple schemas, you'll have
to configure their output file paths in your schema options instead.

- [`tadaOutputLocation`](/reference/config-format#tadaoutputlocation) for
  the [`generate output`](/reference/gql-tada-cli#generate-output) command
- [`tadaTurboLocation`](/reference/config-format#tadaturbolocation) for
  the [`generate turbo`](/reference/gql-tada-cli#generate-turbo) command
- [`tadaPersistedLocation`](/reference/config-format#tadapersistedlocation) for
  the [`generate persisted`](/reference/gql-tada-cli#generate-persisted) command

::: code-group
```json [tsconfig.json] {10-12}
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "gql.tada/ts-plugin",
        "schemas": [
          {
            "name": "pokemon",
            "schema": "./graphql/pokemon.graphql",
            "tadaOutputLocation": "./src/graphql/pokemon-env.d.ts",
            "tadaTurboLocation": "./src/graphql/pokemon-cache.d.ts",
            "tadaPersistedLocation": "./graphql/pokemon-persisted.json"
          },
          /*...*/
        ]
      }
    ]
  }
}
```
:::

<div class="column">
  <a href="/get-started/workflows" class="button">
    <h3>Essential Workflows</h3>
    <p>Learn more about what these CLI Commands do</p>
  </a>
  <a href="/reference/config-format" class="button">
    <h3>Config Format</h3>
    <p>Learn more about the configuration format</p>
  </a>
</div>
