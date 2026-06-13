---
title: Graphcache
description: Typing Graphcache configuration with gql.tada schemas
---

# Graphcache

The `gql.tada/addons/graphcache` module derives Graphcache configuration types
from the same schema you use for `graphql()`.

This keeps Graphcache's runtime behavior unchanged, while adding type inference
for common configuration surfaces:

- `keys` receive the object type they are configuring
- `resolvers` receive typed parent and field argument objects
- `updates` receive typed mutation and subscription payloads and args
- `optimistic` resolvers receive typed mutation args and return typed mutation results
- `cache.resolve()` accepts known fields for typed entities and returns normalized values

## Setup

Install Graphcache next to `urql` and `gql.tada`:

::: code-group

```sh [pnpm]
pnpm add @urql/exchange-graphcache
```

```sh [npm]
npm install @urql/exchange-graphcache
```

```sh [yarn]
yarn add @urql/exchange-graphcache
```

:::

Then import the addon type from `gql.tada/addons/graphcache`.

```ts
// @filename: graphql-env.d.ts
export type introspection = {
  query: 'Query';
  mutation: never;
  subscription: never;
  types: {
    ID: { type: string };
    String: { type: string };
    Int: { type: number };
    Query: {
      kind: 'OBJECT';
      name: 'Query';
      fields: {
        pokemon: {
          name: 'pokemon';
          args: [
            {
              name: 'id';
              type: {
                kind: 'NON_NULL';
                ofType: { kind: 'SCALAR'; name: 'ID'; ofType: null };
              };
            },
          ];
          type: { kind: 'OBJECT'; name: 'Pokemon'; ofType: null };
        };
      };
    };
    Pokemon: {
      kind: 'OBJECT';
      name: 'Pokemon';
      fields: {
        id: {
          name: 'id';
          type: {
            kind: 'NON_NULL';
            ofType: { kind: 'SCALAR'; name: 'ID'; ofType: null };
          };
        };
        name: {
          name: 'name';
          type: {
            kind: 'NON_NULL';
            ofType: { kind: 'SCALAR'; name: 'String'; ofType: null };
          };
        };
      };
    };
  };
};

// @filename: graphql.ts
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql-env';

export const graphql = initGraphQLTada<{
  introspection: introspection;
}>();

// @filename: graphcache.ts
import type { GraphCacheConfig } from 'gql.tada/addons/graphcache';
import { graphql } from './graphql';

export const graphcache = {
  keys: {
    Pokemon: (data) => data.id,
  },
  resolvers: {
    Query: {
      pokemon(_parent, args) {
        return { __typename: 'Pokemon', id: args.id };
      },
    },
  },
} satisfies GraphCacheConfig<typeof graphql>;
```

Pass the same config type to Graphcache's `cacheExchange` generic when creating
your urql client.

```ts
import { cacheExchange } from '@urql/exchange-graphcache';
import { Client, fetchExchange } from 'urql';

import { graphcache } from './graphcache';
import { graphql } from './graphql';
import type { GraphCacheConfig } from 'gql.tada/addons/graphcache';

export const client = new Client({
  url: '/graphql',
  exchanges: [cacheExchange<GraphCacheConfig<typeof graphql>>(graphcache), fetchExchange],
});
```

## Cache Helpers

When `cache.resolve()` receives a typed entity, the field name is checked against
the schema and the return type follows Graphcache's normalized storage model.
Object fields resolve to entity references, while scalar fields resolve to their
scalar value.

```ts
// @filename: graphql-env.d.ts
export type introspection = {
  query: 'Query';
  mutation: never;
  subscription: never;
  types: {
    ID: { type: string };
    String: { type: string };
    Query: { kind: 'OBJECT'; name: 'Query'; fields: {} };
    Pokemon: {
      kind: 'OBJECT';
      name: 'Pokemon';
      fields: {
        id: {
          name: 'id';
          type: {
            kind: 'NON_NULL';
            ofType: { kind: 'SCALAR'; name: 'ID'; ofType: null };
          };
        };
        name: {
          name: 'name';
          type: {
            kind: 'NON_NULL';
            ofType: { kind: 'SCALAR'; name: 'String'; ofType: null };
          };
        };
      };
    };
  };
};

// @filename: graphql.ts
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql-env';

export const graphql = initGraphQLTada<{
  introspection: introspection;
}>();

// @filename: graphcache.ts
import type { GraphCacheConfig } from 'gql.tada/addons/graphcache';
import { graphql } from './graphql';

export const graphcache = {
  resolvers: {
    Pokemon: {
      name(parent, _args, cache) {
        const name = cache.resolve({ __typename: 'Pokemon', id: parent.id }, 'name');
        //    ^?

        return name ?? parent.name;
      },
    },
  },
} satisfies GraphCacheConfig<typeof graphql>;
```

::: tip
If a preprocessed introspection file does not contain field `args`, Graphcache
field args fall back to `Record<string, never>`. Regenerate your gql.tada output
with a version that includes field args to infer resolver, update, and optimistic
mutation arguments.
:::
