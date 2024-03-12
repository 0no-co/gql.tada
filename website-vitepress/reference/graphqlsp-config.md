---
title: GraphQLSP Config
---

import { Tabs, TabItem } from '@astrojs/starlight/components';

`@0no-co/graphqlsp` is set up as a plugin in our TypeScript configuration:

```json {4-10} title="tsconfig.json"
{
  "compilerOptions": {
    "strict": true,
    "plugins": [
      {
        "name": "@0no-co/graphqlsp",
        "schema": "./schema.graphql",
        "tadaOutputLocation": "./src/graphql-env.d.ts"
      }
    ]
  }
}
```

The `name` property, in `tsconfig.json`’s plugins list, referes directly to
the package name of the plugin.

Apart from just, `schema` and `tadaOutputLocation`, `@0no-co/graphqlsp`
accepts several configuration options that may be relevant in certain
edge cases to disable some of its features.

## Configuration Options

This section documents all of the provided configuration options for `@0no-co/graphqlsp`,
explains their default settings, and how to further configure them.

### `schema`

The `schema` option is the only required configuration option, and is used when
the plugin starts up to load your GraphQL API’s schema.
After the schema has been loaded, the provided schema is watched and reloaded
whenever it changes.

The `schema` option currently allows for three different formats to load a schema. It accepts either:

- a path to a `.graphql` file containing a schema definition (in GraphQL SDL format)
- a path to a `.json` file containing a schema’s introspection query data
- a URL to a GraphQL API that can be introspected

<Tabs>
<TabItem label=".graphql file">

```json {6}
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

</TabItem>
<TabItem label=".json file">

```json {6}
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

</TabItem>
<TabItem label="URL">

```json {6}
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

</TabItem>
<TabItem label="URL with headers">

```json {6-11}
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

</TabItem>
</Tabs>

[Read more on how to configure the `schema` option, on the “Installation” page.](../../get-started/installation/#step-2-configuring-a-schema)

### `tadaOutputLocation`

The `tadaOutputLocation`, when set, specifies the file or directory location to write
an introspection type to, which `gql.tada` uses
the plugin starts up to load your GraphQL API’s schema.
After the schema has been loaded, the provided schema is watched and reloaded
whenever it changes.

When the option only specifies a directory, a `introspection.d.ts` file will automatically
be written to the output directory.

The `tadaOutputLocation` option accepts two different formats. Either a `.d.ts` file location,
or a `.ts` file location. Depending on the file extension we specify, two different formats
are used to save the introspection result:

#### Format 1 — `.d.ts` file

When writing a `.d.ts` file, `@0no-co/graphqlsp` will create a declaration file that automatically
declares [a `setupSchema` interface on `gql.tada`](../gql-tada-api/#setupschema) that,
via [declaration merging in TypeScript](https://www.typescriptlang.org/docs/handbook/declaration-merging.html),
configures `gql.tada` to use a schema project-wide for typings.

The resulting file will have the following shape:

```ts title="graphql-env.d.ts" collapse={2-12}
export type introspection = {
  __schema: {
    queryType: {
      name: 'Query';
    };
    mutationType: null;
    subscriptionType: null;
    types: [
      // ...
    ];
    directives: [];
  };
};

import * as gqlTada from 'gql.tada';

declare module 'gql.tada' {
  interface setupSchema {
    introspection: introspection;
  }
}
```

If we want to now customize scalars, for instance, we’ll need to create our own `graphql()` function
by using the `introspection` type with [`gql.tada`’s `initGraphQLTada<>()` function](../gql-tada-api/#initgraphqltada):

```ts title="graphql.ts"
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

[Read more on how to configure the `tadaOutputLocation` option, on the “Installation” page.](../../get-started/installation/#step-3-configuring-typings)

#### Format 2 — `.ts` file

When writing a `.ts` file instead, `@0no-co/graphqlsp` will create a regular TypeScript file that
exports an `introspection` object, which is useful if we’re planning on re-using the introspection
data during runtime.

The resulting file will have the following shape:

```ts title="introspection.ts" collapse={2-12}
const introspection = {
  __schema: {
    queryType: {
      name: 'Query',
    },
    mutationType: null,
    subscriptionType: null,
    types: [
      // ...
    ],
    directives: [],
  },
} as const;

export { introspection };
```

Hence, with this format it’s required to import the introspection and to create a [`graphql()` function](../gql-tada-api/#graphql) using
the [`initGraphQLTada<>()` function](../gql-tada-api/#initgraphqltada). The introspection type won’t be set up project-wide, since the
`.ts` output from `@0no-co/graphqlsp` doesn’t contain a `declare module` declaration.

[Read more on how to configure the `tadaOutputLocation` option, on the “Installation” page.](../../get-started/installation/#initializing-gqltada-manually)

### `template`

By default, `@0no-co/graphqlsp` will recognize any function named `graphql()` or `gql()`
as containing GraphQL documents.

Customizing this option allows us to give these functions another name. For example,
if we wanted to name a function `parseGraphQL` instead, we may set the option to `"parseGraphQL"`.

```json {7}
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@0no-co/graphqlsp",
        "schema": "./schema.graphql",
        "template": "parseGraphQL"
      }
    ]
  }
}
```

:::note
It is not recommended to change the default template name to anything but `gql` or `graphql` for
editor support. Many editors, including VSCode, will syntax highlight GraphQL syntax inside strings
based on function names, and naming the functions anything but `gql` and `graphql` may break syntax
highlighting for you.

In VSCode however, it may be possible to restore syntax highlighting by prefixing strings inside
custom tag functions with an inline `/* GraphQL */` comment.
However, this won’t work in every editor either!
:::

### `templateIsCallExpression`

By default, this option is `true`.
When `templateIsCallExpression: false` is set, `@0no-co/graphqlsp` will instead look for tagged
template literals.

:::caution
Using tagged template literals is incompatible with `gql.tada`!

TypeScript doesn’t currently support constant string literal types to be inferred
from tagged template literals. (See [`microsoft/typescript#49552`](https://github.com/microsoft/TypeScript/pull/49552))
:::

### `trackFieldUsage`

By default, this option is `true`.

When enabled, `@0no-co/graphqlsp` will track how you use the data of GraphQL documents
and issue a warning when any fields in your selection sets aren’t actually used in
your TypeScript code, so you can delete them.

```tsx ins={"GraphQLSP warns: Field 'maxHP is not used.":7-8}
import { FragmentOf, graphql, readFragment } from '../graphql';

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
  return <li>{pokemon.name}</li>;
};
```

In the above example, we add a `maxHP` field to a fragment that the component’s
code does not actually access, which causes a warning to be displayed.

### `shouldCheckForColocatedFragments`

By default, this option is `true`.

When enabled, `@0no-co/graphqlsp` will scan imports for GraphQL fragments. When it finds an
unused fragment in a file that’s imported in the current module, it issues a warning.
This protects us from accidentally forgetting to reuse a fragment from an imported component file.

```tsx ins={"GraphQLSP warns: Unused co-located fragment definition(s)":4-5}
import { useQuery } from 'urql';
import { graphql } from '../graphql';

import { PokemonItem } from './PokemonItem';

const PokemonsQuery = graphql(
  `
    query Pokemons($limit: Int = 10) {
      pokemons(limit: $limit) {
        id
      }
    }
  `,
  []
);

export const PokemonList = () => {
  const [result] = useQuery({ query: PokemonsQuery });
  return null; // ...
};
```

In the above example, we add an import to a `PokemonItem` component.
If the file contains a fragment that we have to use in our query a warning is displayed.
