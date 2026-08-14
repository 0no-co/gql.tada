<div align="center">
  <h2>gql.tada 🪄</h2>
  <strong>Schema-aware GraphQL documents for TypeScript</strong>
  <br />
  <br />
  <a href="https://github.com/0no-co/gql.tada/actions/workflows/release.yml"><img alt="CI Status" src="https://github.com/0no-co/gql.tada/actions/workflows/release.yml/badge.svg?branch=main" /></a>
  <a href="https://urql.dev/discord"><img alt="Discord" src="https://img.shields.io/discord/1082378892523864074?color=7389D8&label&logo=discord&logoColor=ffffff" /></a>
  <br />
  <br />
</div>

`gql.tada` is a GraphQL document-authoring library that infers a query's result and variable
types from your schema. It returns standard `TypedDocumentNode` values, so typed documents work
with GraphQL clients without generating a TypeScript file for every operation.

- GraphQL parsing and type inference happen in TypeScript's type system.
- The TypeScript plugin provides schema-aware completions, diagnostics, and hover information.
- Fragment masking and composition keep component data requirements explicit.
- The CLI supports schema updates, CI diagnostics, persisted documents, Turbo Mode, and
  machine-readable project analysis.

## Quick start

Install `gql.tada`:

```sh
npm install gql.tada
```

Point the TypeScript plugin at your schema and choose where its schema typings should be written:

```json
{
  "compilerOptions": {
    "strict": true,
    "plugins": [
      {
        "name": "gql.tada/ts-plugin",
        "schema": "./schema.graphql",
        "tadaOutputLocation": "./src/graphql-env.d.ts"
      }
    ]
  }
}
```

The schema can be GraphQL SDL, introspection JSON, or an introspectable GraphQL endpoint. Generate
the output once from the command line (the TypeScript plugin also keeps it updated in your editor):

```sh
npx gql-tada generate-output
```

Then author a typed document directly in TypeScript:

```ts
import { graphql } from 'gql.tada';
import type { ResultOf, VariablesOf } from 'gql.tada';

export const PokemonQuery = graphql(`
  query Pokemon($id: ID!) {
    pokemon(id: $id) {
      id
      name
    }
  }
`);

export type PokemonResult = ResultOf<typeof PokemonQuery>;
export type PokemonVariables = VariablesOf<typeof PokemonQuery>;
```

The value returned by `graphql()` is a `TypedDocumentNode`. It can be passed directly to clients
including [urql](https://urql.dev), [Apollo Client](https://www.apollographql.com/docs/react),
[graphql-request](https://github.com/graffle-js/graffle), and other clients that accept typed
GraphQL documents.

For the complete setup, including VSCode, custom scalars, Vue, and Svelte, read the
[installation guide](https://gql-tada.0no.co/get-started/installation).

## Common commands

```sh
npx gql-tada doctor                 # diagnose the local setup
npx gql-tada generate-output        # refresh schema typings
npx gql-tada check                  # run GraphQL diagnostics in CI
npx gql-tada turbo                  # cache document types for large projects
npx gql-tada scan --format json     # analyze document and schema usage
```

See [Essential Workflows](https://gql-tada.0no.co/get-started/workflows) and the
[CLI reference](https://gql-tada.0no.co/reference/gql-tada-cli) for all options.

## Documentation

- [Introduction](https://gql-tada.0no.co/get-started/)
- [Installation](https://gql-tada.0no.co/get-started/installation)
- [Writing GraphQL](https://gql-tada.0no.co/get-started/writing-graphql)
- [Fragment colocation and masking](https://gql-tada.0no.co/guides/fragment-colocation)
- [`gql.tada` API reference](https://gql-tada.0no.co/reference/gql-tada-api)
- [Configuration reference](https://gql-tada.0no.co/reference/config-format)

Agent-friendly documentation is available as a curated
[`llms.txt`](https://gql-tada.0no.co/llms.txt), a complete
[`llms-full.txt`](https://gql-tada.0no.co/llms-full.txt), and a Markdown version of every
documentation page by appending `.md` to its clean URL.

All public APIs also include TSDoc comments, which are available in editor hovers and the
published TypeScript declarations.

## Releases and contributing

All releases are listed on [GitHub Releases](https://github.com/0no-co/gql.tada/releases) and in
[`CHANGELOG.md`](https://github.com/0no-co/gql.tada/blob/main/CHANGELOG.md). Canary releases are
available under the `@canary` npm tag.

To contribute, read the [contributor guide](https://github.com/0no-co/gql.tada/blob/main/CONTRIBUTING.md).
