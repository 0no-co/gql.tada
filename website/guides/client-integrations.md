---
title: GraphQL Client Integrations
description: Use gql.tada typed documents and masked fragments with Apollo Client, urql, and graphql-request.
---

# GraphQL Client Integrations

`graphql()` returns a standard `DocumentNode` carrying inferred result and variables types. Clients
that accept `TypedDocumentNode` can infer their API types directly from a `gql.tada` document; no
client adapter or explicit result generic is required.

Complete the [installation and schema setup](/get-started/installation) first. The examples below
import `graphql` from `gql.tada`; use your project-local export instead if you initialized it with
`initGraphQLTada()`.

## Shared fragment and operation

The same documents can be passed to Apollo Client, urql, or graphql-request:

```ts [pokemon-documents.ts]
import { graphql } from 'gql.tada';

export const PokemonCardFragment = graphql(`
  fragment PokemonCard on Pokemon {
    id
    name
  }
`);

export const PokemonsQuery = graphql(
  `
    query Pokemons($limit: Int!) {
      pokemons(limit: $limit) {
        id
        ...PokemonCard
      }
    }
  `,
  [PokemonCardFragment]
);
```

Passing `[PokemonCardFragment]` is required: a GraphQL spread alone does not compose the fragment
document into the runtime AST or its inferred type.

At the component boundary, accept and unwrap the masked fragment reference:

```tsx [PokemonCard.tsx]
import type { FragmentOf } from 'gql.tada';
import { readFragment } from 'gql.tada';
import { PokemonCardFragment } from './pokemon-documents';

export function PokemonCard(props: {
  data: FragmentOf<typeof PokemonCardFragment>;
}) {
  const pokemon = readFragment(PokemonCardFragment, props.data);
  return <span>{pokemon.name}</span>;
}
```

## Apollo Client

Apollo Client accepts the document directly and infers `data` and `variables`:

```tsx [Pokemons.tsx]
import { useQuery } from '@apollo/client/react';
import { PokemonCard } from './PokemonCard';
import { PokemonsQuery } from './pokemon-documents';

export function Pokemons() {
  const { data, loading, error } = useQuery(PokemonsQuery, {
    variables: { limit: 20 },
  });

  if (loading) return <p>Loading…</p>;
  if (error) return <p>{error.message}</p>;

  return data?.pokemons?.map((pokemon) =>
    pokemon ? <PokemonCard key={pokemon.id} data={pokemon} /> : null
  );
}
```

Do not supply manually maintained `useQuery<Result, Variables>` generics. They can drift from the
selected fields and override the inference carried by the document.

Apollo's normalized cache inspects document ASTs. If you use
[`graphql.persisted()`](/guides/persisted-documents#apollo-client), retain the document at runtime by
passing it as the second argument unless your persisted-query link explicitly supports document IDs.

## urql

The React `urql` package infers types from the `query` property:

```tsx [Pokemons.tsx]
import { useQuery } from 'urql';
import { PokemonCard } from './PokemonCard';
import { PokemonsQuery } from './pokemon-documents';

export function Pokemons() {
  const [{ data, fetching, error }] = useQuery({
    query: PokemonsQuery,
    variables: { limit: 20 },
  });

  if (fetching) return <p>Loading…</p>;
  if (error) return <p>{error.message}</p>;

  return data?.pokemons?.map((pokemon) =>
    pokemon ? <PokemonCard key={pokemon.id} data={pokemon} /> : null
  );
}
```

The core client works the same way without React:

```ts [load-pokemons.ts]
import type { Client } from '@urql/core';
import { PokemonsQuery } from './pokemon-documents';

export async function loadPokemons(client: Client) {
  const result = await client.query(PokemonsQuery, { limit: 20 }).toPromise();
  if (result.error) throw result.error;
  return result.data;
}
```

When using persisted documents with urql, follow the
[persisted document integration](/guides/persisted-documents#urql-client) so the cache sees the
formatted AST it expects.

## graphql-request

Both the convenience function and `GraphQLClient` accept typed documents:

```ts [load-pokemons.ts]
import { GraphQLClient } from 'graphql-request';
import { PokemonsQuery } from './pokemon-documents';

const client = new GraphQLClient('/graphql');

export function loadPokemons() {
  return client.request(PokemonsQuery, { limit: 20 });
}
```

The returned promise carries the operation result type and the variables argument is checked against
the GraphQL declaration.

## Other clients and transport layers

A compatible API should accept `TypedDocumentNode<Result, Variables>` (or a regular
`DocumentNode`) and infer both generic parameters from it. For a custom transport, derive types only
at its boundary:

```ts
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';

export async function execute<Result, Variables>(
  document: TypedDocumentNode<Result, Variables>,
  variables: Variables
): Promise<Result> {
  // Serialize and send `document` with your transport here.
  throw new Error('Transport not implemented');
}
```

Do not stringify a `gql.tada` document and then recover its result with a cast. Preserve the typed
document through the client API.

## Validate an integration

Use the CLI and TypeScript rather than relying only on editor feedback:

```sh
gql-tada doctor
gql-tada generate output
gql-tada check --fail-on-warn
tsc --noEmit
```

If a client fails to infer types, confirm that its installed version accepts `TypedDocumentNode`,
that the generated `graphql-env.d.ts` is included by TypeScript, and that the operation is passed as
the document rather than converted to an untyped string.
