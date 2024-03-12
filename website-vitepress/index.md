---
title: Introduction
---

# Introduction

> [!NOTE]
>
> `gql.tada`’s documentation is still a work in progress.
> If you have any feedback, feel free to let us know what you’d like to see explained or changed.

The `gql.tada` project aims to improve the experience of writing and using GraphQL
with TypeScript on the client-side by providing more feedback when writing GraphQL,
and reducing friction between TypeScript and GraphQL.

`gql.tada` as a project was started to answer the question:
“Why can’t we teach TypeScript to understand the GraphQL query language?”

Once `gql.tada` is set up, we write our GraphQL queries in pure TypeScript,
our queries automatically infer their types, and our editor introspects our
GraphQL schema and provides immediate feedback, auto-completion, diagnostics,
and GraphQL type hints.<br />
This all happens on-the-fly in TypeScript.

[Read on on the “Installation” page, to get started! 🪄](./get-started/installation/)

### A demo in 128 seconds

<video controls autoplay loop muted>
  <source src="https://gql-tada-demo-video.pages.dev/demo.mp4" type="video/mp4" />
</video>

## How does it work?

The project currently contains two installable modules:

- `gql.tada`, the package providing typings and the runtime API as a library,
- `@0no-co/graphqlsp`, a TypeScript Language Service plugins for editor feedback and integration.

As you start your editor, `@0no-co/graphqlsp` is started as a TypeScript Language Service
plugin, which allows it to integrate with the same process that provides your editor
with type hints, diagnostics, and auto-completions; the TypeScript language server
process.

During this time, `@0no-co/graphqlsp` will retrieve your GraphQL schema, find GraphQL
documents and provide added diagnostics and features using your schema information.
It will also output an introspection file for `gql.tada` to use.

The GraphQL documents, written with `gql.tada` will be parsed — all inside TypeScript
typings — and are combined with the introspection information that `@0no-co/graphqlsp`
provides to create typings for GraphQL result and variables types.

This means, all we see in our code is the plain GraphQL documents with no annotations or distractions:

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

## How does it compare to other solutions?

Typically, when integrating client-side GraphQL code with TypeScript, other solutions
will generate typings files for GraphQL documents.

This means that you’ll need to run a persistent and separate process that watches your
TypeScript files, and generates more auto-generated TypeScript files containing your
GraphQL types.

This leads to the additional friction of having additional generated files around and
causing the TypeScript process to having to watch your files, error on changes, picking
up the newly generated files, and updating the checks. In other words, these tools cause
a “split” between what TypeScript sees, what you see, and what the code generator sees.

`gql.tada` instead takes the approach of generating the typings fully in TypeScript to
eliminate this “split experience”, reducing friction. All while writing actual GraphQL
queries, rather than an object-syntax, which is only an approximation of GraphQL queries.

## Which GraphQL query language features are supported?

`gql.tada` supports the entire GraphQL query language syntax, and aims to support all
type features that are relevant to GraphQL clients that support typed GraphQL documents
(via `TypedDocumentNode`s).

Currently, the list of supported features is:

- Mapping selection sets mapping to object-like types to TypeScript object types
- Grouping type mappings of possible types for interfaces and unions
- `@defer`, `@skip`, and `@include` directives switching fields and fragments to be optional
- resolving inline fragment and fragment spreads in documents
- inferring the type of `__typename` fields
- resolving types of custom scalars from a configuration

## Next steps

[The next page, “Installation”](./get-started/installation/), will show you how to install and set up `gql.tada` and `@0no-co/graphqlsp`.

[The following page, “Writing GraphQL”](./get-started/writing-graphql/), will show you how to use `gql.tada` and write GraphQL documents with it.
