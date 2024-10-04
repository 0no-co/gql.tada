---
title: Persisted Documents
description: How to integrate with and generate persisted documents
---

# Persisted Documents

<section>
Also known as "Persisted Queries", persisted documents is a technique
used to implement security measures, CDN caching, or to improve API
performance.
</section>

APIs that support Persisted Documents use identifiers that are sent
to the GraphQL API instead of the complete GraphQL documents.
This requires that the identifiers are embedded in our code and
that the documents are known to our GraphQL API.

::: details What are Persisted Documents?
  We call a document a "persisted document" if it has an ID that
  identifies it. A GraphQL API that implements persisted documents
  will typically accept an ID instead of a full `query` parameter,
  containing the full GraphQL document.

  When used for CDN caching, a GraphQL API may accept a request with
  a document ID as a `GET` HTTP request, making CDN caching trivial,
  since it turns GraphQL requests into CDN-cacheable RPC calls.

  Some GraphQL API frameworks may implement optimizations for persisted
  documents. Since the documents are known ahead of time, they can parse
  and validate the document just once. When the API is running and
  receives a persisted document ID, it may already assume that the
  document is valid.

  When used as a security measure, a GraphQL API may reject unknown
  queries by checking the ID against a list of allowed documents.
  This effectively limits the GraphQL queries your API accepts to
  just documents you've written yourself.
:::

::: details How do they differ from <u>Automatic</u> Persisted Queries?
  **Persisted Documents** are not the same as **Automatic Persisted Queries**.

  Automatic Persisted Queries are a protocol extension for which the ID
  for documents are hashed and generated on the client-side, during runtime,
  automatically, and registered with the API if it does not recognize an ID.

  If your API supports them, you won't need to modify your `gql.tada` code
  to make use of this feature. However, you also won't be able to implement
  any of the security benefits of Persisted Documents, as documents are
  registered dynamically with the API, instead of ahead of time.
:::

---

## Defining Persisted Documents

We may define persisted documents by using the `graphql.persisted()` API.
This call wraps around a GraphQL document and annotates it with a document
ID that we pass to the call.

```ts twoslash
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { graphql } from 'gql.tada';

const pokemonsQuery = graphql(`
  query PokemonsList($limit: Int = 10) {
    pokemons(limit: $limit) {
      id
      name
    }
  }
`);

const persistedQuery = graphql.persisted("POKEMONS_LIST_ID", pokemonsQuery);
```

The replacement document - `persistedQuery` in our example - copies
the type of the document it receives, so type inference will still work as
usual when we use it instead of the original query.

However, the returned document will also carry a `documentId` property with
it, which is set to the ID we passed to `graphql.persisted`.<br />
In this case, it'll be set to `"POKEMONS_LIST_ID"`.

### Compiling away GraphQL documents

When using **Persisted Documents** as a security measure, the API enforces
them and only accepts known document IDs.

You may wish to combine this with a technique to obscure GraphQL documents,
by omitting them from your client-side output bundles entirely. Compiling
GraphQL documents is often done to completely obscure the arguments and
types shape of your GraphQL schema.

::: tip Compatibility with GraphQL clients
Check whether your GraphQL clients supports omitting the original GraphQL
document.

Many GraphQL client caches rely on the original document and its `definitions`
to be available to them, either to provide normalized caching, or to identify
the document uniquely.
:::

This can be achieved by passing the original GraphQL document as a type
to a `graphql.persisted()` call.

```ts twoslash
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { graphql } from 'gql.tada';

const pokemonsQuery = graphql(`
  query PokemonsList($limit: Int = 10) {
    pokemons(limit: $limit) {
      id
      name
    }
  }
`);

const persistedQuery = graphql.persisted<typeof pokemonsQuery>(
  "POKEMONS_LIST_ID"
);
```

When passing the original document as a generic, the return type of
`graphql.persisted()` remains identical, but the document string
itself will be omitted from your compiled output bundle, provided
the original document - `pokemonsQuery` in our example - isn't
referenced anywhere else in your code.

::: details When and why does this work?
  When we refer to the document using `typeof`, this refers to a
  value by type instead of by value.

  Since a `graphql()` call is side effectless and `typeof` only
  refers to it by type, no reference to the original value remain
  in TypeScript's transpiled output code.

  This lets **tree-shaking and minification** remove the original value,
  which effectively removes the original GraphQL document definition
  from your compiled output bundle, as long as either of these
  mechanisms work properly in your bundles or app framework.
:::

---

### Using generated IDs

Many GraphQL APIs choose to use hashes as GraphQL document IDs, since the
IDs for documents don't necessarily have to be human-readable, and often
need to change when the document changes.

Since it's tedious to manually generate hashes for a GraphQL document and
to keep track of when it changes, the TypeScript plugin has to mechanisms to
help us with hashed document IDs:

- it provides a **code action** that generates a SHA256 hash of your document
- a **diagnostic** warns you if this SHA256 hash needs to be updated

The code action will be reported to your editor once you have defined
a `graphql.persisted()` call. When activated, it will replace the current
document ID passed to the call with a new hash.
In our example above, we'd end up with the following code after:

```ts
const persistedQuery = graphql.persisted(
  "sha256:89e47d4f32b4ff76296844ff260d2878bf1829d30706fc7fc92de0fc66c2a4cf",
  pokemonsQuery
);
```

## Generating Persisted Manifests

<section>
  To statically extract persisted documents, we can use the <code>gql-tada</code>
  CLI's <code>generate persisted</code> command.
</section>

Embedding document IDs with our `gql.tada` documents allows us to send
them to our GraphQL API. However, the other half of making Persisted Documents
work is extracting and registering GraphQL documents from our codebase.

To generate a persisted JSON manifest file, use the `gql.tada` CLI's
`generate persisted` command.

```sh
gql-tada generate persisted --output persisted.json
```

The `generate persisted` command scans your codebase for persisted
GraphQL documents by looking for `graphql.persisted()` calls, and
evaluates and extracts them into a JSON file.

To omit the `--output` argument, you can update your configuration
to change where this persisted manifest file gets written to with
the `tadaPersistedLocation` setting:

::: code-group
```json [tsconfig.json]
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "gql.tada/ts-plugin",
        "schema": "./schema.graphql",
        "tadaOutputLocation": "./src/graphql-env.d.ts",
        "tadaPersistedLocation": "./persisted.json" // [!code ++]
      }
    ]
  }
}
```
:::

### Using the persisted manifest file

The persisted manifest file is a JSON file that contains document
entries. Each entry is keyed by a document ID and has a value of the
GraphQL detected document.

In our example code this would result in a file containing a
`"POKEMONS_LIST_ID"` with our document as a GraphQL document value:

```json
{
  "POKEMONS_LIST_ID": "\n  query Pokemons ($limit: Int = 10) {\n    pokemons(limit: $limit) {\n      id\n      name\n    }\n  }\n\n\nfragment PokemonItem on Pokemon {\n  id\n  name\n}"
}
```

The document string is a combination of the original string
that your `graphql()` call receives with all fragments it
references appended to it.

::: tip Formatting Documents
The persisted manifest file may not contain the documents exactly
how your GraphQL client would format it.
GraphQL clients often format documents to add introspection fields
to them, most commonly adding `__typename` fields to selection sets.

As such, you may want to format and modify the GraphQL document strings
before registering them with your GraphQL API.
:::

---

## Integration with GraphQL Clients

The ["GraphQL over HTTP" specification](https://github.com/graphql/graphql-over-http/blob/persisted-documents/spec/Appendix%20A%20--%20Persisted%20Documents.md)
is looking to standardize how persisted documents are sent to GraphQL APIs via HTTP.
If your GraphQL client supports this specification, you likely won't have to do
anything else to send persisted documents to your API, as long as your API
supports them.

> [!NOTE]
> "GraphQL over HTTP" is currently a _Stage 2_ proposal and is not fully implemented
> by all GraphQL clients and servers yet. The Persisted Documents appendix of the
> specification is an early RFC and not implemented by most servers yet.

---

### `urql` Client

By default, `@urql/core` will omit the `query` property and send a `documentId`
property containing the document ID instead when you're using persisted documents.
If your API supports this request format, there's nothing else you have to do.

#### Formatting Persisted Documents

Before you can register the documents in your persisted manifest file
with your GraphQL API, you should format the documents the same way
`@urql/core` does, if you're using a `cacheExchange`.

```ts twoslash
import { print, parse } from '@0no-co/graphql.web';
import { formatDocument } from '@urql/core';

export function formatClientDocument(document: string) {
  return print(formatDocument(parse(document)));
}
```

Before `urql` sends a GraphQL document to your API, it formats
the document to add `__typename` fields to the selection set. Applying
the above transform to your persisted JSON manifest file's documents
ensures that your API will process the same GraphQL operation that
`urql` expects to receive a result for.

#### `@urql/exchange-persisted`

If your API supports the unofficial
[Apollo Automatic Persisted Queries protocol](https://github.com/apollographql/apollo-link-persisted-queries#apollo-engine) instead, you'll have to use the `@urql/exchange-persisted`
exchange.

::: details Automatic Persisted Queries protocol
The Automatic Persisted Queries protocol sends omits the `query` property
from requests, and sends the document ID under the
`extensions.persistedQuery.sha256Hash` property.

```json
{
  "variables": null,
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "DOCUMENT_ID"
    }
  }
}
```
:::

First, install the `@urql/exchange-persisted` package:

::: code-group
```sh [npm]
npm install @urql/exchange-persisted
```

```sh [pnpm]
pnpm add @urql/exchange-persisted
```

```sh [yarn]
yarn add @urql/exchange-persisted
```

```sh [bun]
bun add @urql/exchange-persisted
```
:::

You'll then need to add the `persistedExchange` to your exchanges, in front of the `fetchExchange`.

```ts twoslash
import type { TadaPersistedDocumentNode } from 'gql.tada';
import { Client, fetchExchange, cacheExchange } from 'urql';
import { persistedExchange } from '@urql/exchange-persisted';

export const client = new Client({
  url: '/graphql',
  exchanges: [
    cacheExchange,
    persistedExchange({
      async generateHash(_, document) {
        return (document as TadaPersistedDocumentNode).documentId;
      },
      preferGetForPersistedQueries: true,
      enforcePersistedQueries: true,
      enableForMutation: true,
      enableForSubscriptions: true,
    }),
    fetchExchange,
  ],
});
```

When `preferGetForPersistedQueries` is enabled, query operations will be
sent as `GET` HTTP requests instead of `POST` requests, which makes
CDN caching simpler to enable.

<a href="https://urql.dev/goto/docs/advanced/persistence-and-uploads/" class="button">
  Learn more on the urql docs
</a>

---

### Apollo Client

You'll have to use the built-in `createPersistedQueryLink` function
and add the link in front of your HTTP link.

```ts twoslash
import type { TadaPersistedDocumentNode } from 'gql.tada';
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { createPersistedQueryLink } from '@apollo/client/link/persisted-queries';

const link = createPersistedQueryLink({
  generateHash(document) {
    return (document as TadaPersistedDocumentNode).documentId;
  },
  useGETForHashedQueries: true,
}).concat(new HttpLink({ uri: '/graphql' }));

export const client = new ApolloClient({
  cache: new InMemoryCache(),
  link,
});
```

This will send your persisted documents using the unofficial
[Apollo Automatic Persisted Queries protocol](https://github.com/apollographql/apollo-link-persisted-queries#apollo-engine).

::: details Automatic Persisted Queries protocol
The Automatic Persisted Queries protocol sends omits the `query` property
from requests, and sends the document ID under the
`extensions.persistedQuery.sha256Hash` property.

```json
{
  "variables": null,
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "DOCUMENT_ID"
    }
  }
}
```
:::

When `useGETForHashedQueries` is enabled, query operations will be
sent as `GET` HTTP requests instead of `POST` requests, which makes
CDN caching simpler to enable.

#### Formatting Persisted Documents

Before you can register the documents in your persisted manifest file
with your GraphQL API, you should format the documents the same way
the Apollo Client does.

```ts twoslash
import { print, parse } from 'graphql';
import { addTypenameToDocument } from '@apollo/client/utilities';

export function formatClientDocument(document: string) {
  return print(addTypenameToDocument(parse(document)));
}
```

Before Apollo Client sends a GraphQL document to your API, it formats
the document to add `__typename` fields to the selection set. Applying
the above transform to your persisted JSON manifest file's documents
ensures that your API will process the same GraphQL operation that
Apollo Client expects to receive a result for.

<a href="https://www.apollographql.com/docs/react/api/link/persisted-queries/#apq-implementation" class="button">
  Learn more on the Apollo Client docs
</a>
