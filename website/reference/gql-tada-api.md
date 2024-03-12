---
title: gql.tada API
---

# `gql.tada` API

## Functions

### `graphql()`

|                      | Description                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| `input` argument     | A string of a GraphQL document.                                         |
| `fragments` argument | An optional list of other GraphQL fragments created with this function. |
| returns              | A GraphQL `DocumentNode` with result and variables types.               |

Creates a `DocumentNode` with result and variables types.

You can compose fragments into this function by passing them and a fragment
mask will be created for them.
When creating queries, the returned document of queries can be passed into GraphQL clients
which will then automatically infer the result and variables types.

It is used with your schema in `setupSchema` to create a result type
of your queries, fragments, and variables.
If you instead would like to manually create a `graphql` function with an explicit schema type,
[use `initGraphQLTada` instead.](#initgraphqltada)

#### Example

```ts twoslash
// @filename: graphq-env.d.ts
export type introspection = {
  "__schema": {
    "queryType": {
      "name": "Query"
    },
    "mutationType": null,
    "subscriptionType": null,
    "types": [
      {
        "kind": "OBJECT",
        "name": "Query",
        "fields": [
          {
            "name": "hello",
            "type": {
              "kind": "SCALAR",
              "name": "String",
              "ofType": null
            },
            "args": []
          },
          {
            "name": "world",
            "type": {
              "kind": "SCALAR",
              "name": "String",
              "ofType": null
            },
            "args": []
          }
        ],
        "interfaces": []
      },
      {
        "kind": "SCALAR",
        "name": "String"
      }
    ],
    "directives": []
  }
};

import * as gqlTada from 'gql.tada';

declare module 'gql.tada' {
  interface setupSchema {
    introspection: introspection
  }
}

// @filename: index.ts
import './graphql-env.d.ts';
// ---cut---
import { graphql } from 'gql.tada';

const fragment = graphql(`
  fragment HelloWorld on Query {
    hello
    world
  }
`);

const query = graphql(`
  query HelloQuery {
    hello
    ...HelloWorld
  }
`, [fragment]);
```

### `graphql.scalar()`

|                  | Description                                    |
| ---------------- | ---------------------------------------------- |
| `name` argument  | A name of a GraphQL scalar or enum.            |
| `value` argument | The value to be type-checked against the type. |
| returns          | The `value` will be returned directly.         |

Type checks a given input value to be of a scalar or enum type and
returns the value directly.

You can use this utility to add a type check for a scalar or enum value,
or to retrieve the type of a scalar or enum.
This is useful if you’re writing a function or component that only accepts
a scalar or enum, but not a full fragment.

> [!NOTE]
> It’s not recommended to use this utiliy to replace fragments, i.e. to
> create your own object types. Try to use fragments where appropriate
> instead.

#### Example

```ts {"Call graphql.scalar to type check a value against a scalar type:":4-5} {"Use ReturnType to get the type of a scalar directly:":8-9}
import { graphql } from 'gql.tada';

function validateMediaEnum(value: 'Book' | 'Song' | 'Video') {
  const media = graphql.scalar('Media', value);
}

type Media = ReturnType<typeof graphql.scalar<'Media'>>;
```

```ts twoslash
// @filename: graphq-env.d.ts
export type introspection = {
  "__schema": {
    "queryType": {
      "name": "Query"
    },
    "mutationType": null,
    "subscriptionType": null,
    "types": [
      {
        "kind": "OBJECT",
        "name": "Query",
        "fields": [],
        "interfaces": []
      },
      {
        "kind": "ENUM",
        "name": "Media",
        "enumValues": [
          { "name": "Book" },
          { "name": "Song" },
          { "name": "Video" }
        ]
      }
    ],
    "directives": []
  }
};

import * as gqlTada from 'gql.tada';

declare module 'gql.tada' {
  interface setupSchema {
    introspection: introspection
  }
}

// @filename: index.ts
import { graphql } from 'gql.tada';

function validateMediaEnum(value: 'Book' | 'Song' | 'Video') {
  const media = graphql.scalar('Media', value);
}

type Media = ReturnType<typeof graphql.scalar<'Media'>>;
```

### `readFragment()`

|                               | Description                                                              |
| ----------------------------- | ------------------------------------------------------------------------ |
| `_document` optional argument | A GraphQL document of a fragment, created using [`graphql()`](#graphql). |
| `fragment` argument           | A mask of the fragment, which can be wrapped in arrays, or nullable.     |
| returns                       | The unmasked data of the fragment.                                       |

When [`graphql()`](#graphql) is used to create a fragment and is spread into another
fragment or query, their result types will only contain a “reference” to the
fragment. This encourages isolation and is known as “fragment masking.”

This means that you must use `readFragment()` to unmask these fragment masks
and get to the data. This encourages isolation and only using the data you define
a part of your codebase to require:

```ts
const unmaskedData = readFragment(Fragment, maskedData);
```

When passing `fragment` masks to `readFragment()`, you may also pass nullable, optional data, or data
wrapped in arrays to `readFragment()` and the result type will be unwrapped and inferred accordingly.

Instead of passing the fragment document as the first argument, you may also pass it as a generic,
since it's not used as a runtime value anyway:

```ts
const unmaskedData = readFragment<typeof Fragment>(maskedData);
```

[Read more about fragment masking on the “Writing GraphQL” page.](../get-started/writing-graphql#fragment-masking)

#### Example

```ts twoslash
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { FragmentOf, ResultOf, graphql, readFragment } from 'gql.tada';

const pokemonItemFragment = graphql(`
  fragment PokemonItem on Pokemon {
    id
    name
  }
`);

const getPokemonItem = (
  data: FragmentOf<typeof pokemonItemFragment> | null
) => {
// @annotate: Unmasks the fragment and casts to the result type:

  const pokemon = readFragment(pokemonItemFragment, data);
};

const pokemonQuery = graphql(`
  query Pokemon($id: ID!) {
    pokemon(id: $id) {
      id
      ...PokemonItem
    }
  }
`, [pokemonItemFragment]);

const getQuery = (data: ResultOf<typeof pokemonQuery>) => {
  getPokemonItem(data.pokemon);
};
```

### `maskFragments()`

|                       | Description                                                                      |
| --------------------- | -------------------------------------------------------------------------------- |
| `_fragments` argument | A list of GraphQL documents of fragments, created using [`graphql()`](#graphql). |
| `data` argument       | The combined result data of the fragments, which can be wrapped in arrays.       |
| returns               | The masked data of the fragments.                                                |

> [!NOTE]
> While useful, `maskFragments()` is mostly meant to be used in tests or as
> an escape hatch to convert data to masked fragments.
>
> You shouldn’t have to use it in your regular component code.

When [`graphql()`](#graphql) is used to compose fragments into another fragment or
operation, the resulting type will by default be masked, [unless the `@_unmask`
directive is used.](../guides/fragment-colocation#fragment-masking)

This means that when we’re writing tests or are creating “fake data” without
inferring types from a full document, the types in TypeScript may not match,
since our testing data will not be masked and will be equal to [the result type](#resultof)
of the fragments.

To address this, the `maskFragments` utility takes a list of fragments and masks data (or an array of data)
to match the masked fragment types of the fragments.

- [Read more about fragment masking on the “Writing GraphQL” page.](../get-started/writing-graphql#fragment-masking)
- [For the reverse operation, see `readFragment()`.](#readfragment)

#### Example

```ts twoslash
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { graphql, maskFragments } from 'gql.tada';

const pokemonItemFragment = graphql(`
  fragment PokemonItem on Pokemon {
    id
    name
  }
`);

const data = maskFragments([pokemonItemFragment], {
  id: '001',
  name: 'Bulbasaur'
});
```

### `unsafe_readResult()`

|                      | Description                                                          |
| -------------------- | -------------------------------------------------------------------- |
| `_document` argument | A GraphQL document, created using [`graphql()`](#graphql).           |
| `data` argument      | The result data of the GraphQL document with optional fragment refs. |
| returns              | The masked result data of the document.                              |

> [!CAUTION]
> Unlike, [`maskFragments()`](#maskfragments), this utility is unsafe, and
> should only be used when you know that data matches the expected shape
> of a GraphQL query you created.
>
> While useful, this utility is only a slightly safer alternative to `as any`
> and doesn’t type check the result shape against the masked fragments in your
> document.
>
> You shouldn’t have to use it in your regular app code.

When [`graphql()`](#graphql) is used to compose fragments into a document,
the resulting type will by default be masked, [unless the `@_unmask`
directive is used.](../guides/fragment-colocation#fragment-masking)

This means that when we’re writing tests and are creating “fake data”,
for instance for a query, that we cannot convert this data to the query’s
result type, if it contains masked fragment refs.

To address this, the `unsafe_readResult` utility accepts the document and
converts a query’s data to masked data.

#### Example

```ts twoslash
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { graphql, unsafe_readResult } from 'gql.tada';

const pokemonItemFragment = graphql(`
  fragment PokemonItem on Pokemon {
    id
    name
  }
`);

const query = graphql(`
  query {
    pokemon(id: "001") {
      ...PokemonItem
    }
  }
`, [pokemonItemFragment]);

// @warn: data will be cast (unsafely!) to the result type

const data = unsafe_readResult(query, {
  pokemon: { id: '001', name: 'Bulbasaur' },
});
```

### `initGraphQLTada()`

|                 | Description                                                           |
| --------------- | --------------------------------------------------------------------- |
| `Setup` generic | An [`AbstractSetupSchema` configuration object](#abstractsetupschema) |
| returns         | A typed [`graphql()`](#graphql) function.                             |

`initGraphQLTada` accepts an [`AbstractSetupSchema` configuration object](#abstractsetupschema) as a generic
and returns [a `graphql()` function](#graphql) that may be used to create documents typed using your
GraphQL schema.

You should use and re-export the resulting function named as `graphql` or `gql` for your
editor and the TypeScript language server to recognize your GraphQL documents correctly.

[Read more about how to use `initGraphQLTada()` on the “Installation” page.](../get-started/installation#initializing-gqltada-manually)

#### Example

```ts twoslash
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql/graphql-env.d.ts';

export const graphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    DateTime: string;
    Json: any;
  };
}>();

const query = graphql(`
  {
    __typename
  }
`);
```

## Types

### `ResultOf`

|                    | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| `Document` generic | The document type of a `DocumentNode` carrying the result type. |

This accepts a [`TadaDocumentNode`](#tadadocumentnode) and returns the attached `Result` type
of GraphQL documents.

### `VariablesOf`

|                    | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `Document` generic | The document type of a `DocumentNode` carrying the variables type. |

This accepts a [`TadaDocumentNode`](#tadadocumentnode) and returns the attached `Variables` type
of GraphQL documents.

### `FragmentOf`

|                    | Description                                        |
| ------------------ | -------------------------------------------------- |
| `Document` generic | A `DocumentNode` containing a fragment definition. |

Creates a fragment mask for a given fragment document.

When [`graphql()`](#graphql) is used to create a fragment and is spread into another
fragment or query, their result types will only contain a “reference” to the
fragment. This encourages isolation and is known as “fragment masking.”

While [`readFragment()`](#readfragment) is used to unmask these fragment masks, this utility
creates a fragment mask, so you can accept the masked data in the part of your
codebase that defines a fragment.

[Read more about fragment masking on the “Writing GraphQL” page.](../get-started/writing-graphql#fragment-masking)

#### Example

```ts twoslash
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { FragmentOf, graphql, readFragment } from 'gql.tada';

const pokemonItemFragment = graphql(`
  fragment PokemonItem on Pokemon {
    id
    name
  }
`);

// May be called with any data that contains the mask
const getPokemonItem = (data: FragmentOf<typeof pokemonItemFragment>) => {
  // Unmasks the fragment and casts to the result type
  const pokemon = readFragment(pokemonItemFragment, data);
};
```

### `TadaDocumentNode`

|                     | Description                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `Result` generic    | The type of GraphQL results, as returned by GraphQL APIs for a given query. |
| `Variables` generic | The type of variables, as accepted by GraphQL APIs for a given query.       |

A GraphQL `DocumentNode` with attached types for results and variables.

This is a GraphQL `DocumentNode` with attached types for results and variables.
This is used by GraphQL clients to infer the types of results and variables and provide
type-safety in GraphQL documents.

You can create typed GraphQL documents using the [`graphql()` function.](#graphql)

### `setupSchema`

You may extend this interface via declaration merging with your `IntrospectionQuery`
data and optionally your scalars to get proper type inference.
This is done by declaring a declaration for it as per the following example.

Configuring scalars is optional and by default the standard scalrs are already
defined.

This will configure the default `graphql()` export to infer types from your schema.
Alternatively, if you don’t want to define your schema project-wide,
you may call [`initGraphQLTada()`](#initgraphqltada) instead.

[Read more about setting up your schema on the “Installation” page.](../get-started/installation#step-3-configuring-typings)

#### Example

```ts twoslash
import type { introspection } from './graphql/graphql-env.d.ts';

declare module 'gql.tada' {
  interface setupSchema {
    introspection: introspection;
    scalars: {
      DateTime: string;
      Json: any;
    };
  }
}
```

### `AbstractSetupSchema`

|                          | Description                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `introspection` property | Introspection of your schema in the `IntrospectionQuery` format.                                |
| `scalars` property       | An optional object type with scalar names as keys and the corresponding scalar types as values. |
| `disableMasking` flag    | This may be set to `true` to disable fragment masking globally.                                 |

This is used either via [`setupSchema`](#setupschema) or [`initGraphQLTada()`](#initgraphqltada) to set
up your schema and scalars. Your configuration objects must match the shape of this type.

The `scalars` option is optional and can be used to set up more scalars, apart
from the default ones (like: Int, Float, String, Boolean).
It must be an object map of scalar names to their desired TypeScript types.

The `disableMasking` flag may be set to `true` instead of using `@_unmask` on individual fragments
and allows fragment masking to be disabled globally.
