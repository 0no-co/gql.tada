---
title: Graphcache
description: Typing Graphcache configuration with gql.tada schemas
---

# Graphcache <Badge type="warning" text="experimental" />

The `gql.tada/addons/graphcache` module derives Graphcache configuration types
from the same schema you use for `graphql()`.

This keeps Graphcache's runtime behavior unchanged, while adding type inference
for common configuration surfaces:

- `keys` receive the object type they are configuring
- `resolvers` receive typed parent and field argument objects, and their results are checked against the field's type
- `updates` receive typed parent data and field arguments, on root types and any other object type
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

Then pass the type of your `graphql()` function to `GraphCacheConfig`, which you
import from `gql.tada/addons/graphcache`, and check your config against it with
`satisfies`.

```ts twoslash
import './graphql/graphql-env.d.ts';
// ---cut-before---
import type { GraphCacheConfig } from 'gql.tada/addons/graphcache';
import { graphql } from 'gql.tada';

export const graphcache = {
  keys: {
    Pokemon: (data) => data.id || null,
  },
  resolvers: {
    Query: {
      pokemon(_parent, args) {
      //               ^?
        return { __typename: 'Pokemon', id: args.id };
      },
    },
  },
} satisfies GraphCacheConfig<typeof graphql>;
```

Afterwards, pass the config to Graphcache's `cacheExchange` when creating your
urql client.

```ts
import { cacheExchange } from '@urql/exchange-graphcache';
import { Client, fetchExchange } from 'urql';

import { graphcache } from './graphcache';

export const client = new Client({
  url: '/graphql',
  exchanges: [cacheExchange(graphcache), fetchExchange],
});
```

::: warning
Prefer `satisfies GraphCacheConfig<typeof graphql>` over passing the config type
as a generic, as in `cacheExchange<GraphCacheConfig<typeof graphql>>()`. The generic
makes TypeScript compare the config type for every type in your schema against
Graphcache's own types, which can take several seconds on large schemas.
:::

## Updates

Updaters receive the result data of the field they're defined on. On `Mutation`
and `Subscription` fields this is the operation's result, while on any other type
it's the entity's data that's being written to the cache.

```ts twoslash
import './graphql/graphql-env.d.ts';
// ---cut-before---
import type { GraphCacheConfig } from 'gql.tada/addons/graphcache';
import { graphql } from 'gql.tada';

export const graphcache = {
  updates: {
    Mutation: {
      markCollected(result, args, cache) {
        if (!result.markCollected) {
          cache.invalidate({ __typename: 'Pokemon', id: args.id });
        }
      },
    },
    Pokemon: {
      collected(parent, _args, cache) {
      //        ^?
        cache.invalidate('Query', 'pokemons');
      },
    },
  },
  optimistic: {
    markCollected(args) {
      return { __typename: 'Pokemon', id: args.id, collected: true };
    },
  },
} satisfies GraphCacheConfig<typeof graphql>;
```

## Cache Helpers

When `cache.resolve()` receives a typed entity, or the name of your schema's
`Query` type, the field name is checked against the schema and the return type
follows Graphcache's normalized storage model. Object fields resolve to entity
references, while scalar fields resolve to their scalar value.

```ts twoslash
import './graphql/graphql-env.d.ts';
// ---cut-before---
import type { GraphCacheConfig } from 'gql.tada/addons/graphcache';
import { graphql } from 'gql.tada';

export const graphcache = {
  resolvers: {
    Pokemon: {
      name(parent, _args, cache) {
        const name = cache.resolve({ __typename: 'Pokemon', id: parent.id! }, 'name');
        //    ^?

        return name ?? parent.name;
      },
    },
    Query: {
      pokemons(_parent, _args, cache) {
        return cache.resolve('Query', 'pokemons');
      },
    },
  },
} satisfies GraphCacheConfig<typeof graphql>;
```

References returned by `cache.resolve()` stay typed, so they can be passed to
`cache.resolve()` again. Entity keys passed as plain strings, such as `'Pokemon:1'`,
fall back to Graphcache's untyped `cache.resolve()` signature.

## Limitations

- Resolvers may only be configured on object types, since Graphcache doesn't call
  resolvers on interfaces or unions.
- Custom scalars that you haven't given a type in your `scalars` configuration are
  typed as Graphcache's generic scalar type, rather than `unknown`.

::: tip
If a preprocessed introspection file does not contain field `args`, Graphcache
field args fall back to `Record<string, never>`. Regenerate your gql.tada output
with a version that includes field args to infer resolver, update, and optimistic
mutation arguments.
:::
