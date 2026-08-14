---
title: Migrating from GraphQL Code Generator
description: Migrate generated GraphQL operation types and documents to gql.tada incrementally and safely.
---

# Migrating from GraphQL Code Generator

`gql.tada` creates typed GraphQL documents from your schema and the document string itself.
Instead of generating a result type, variables type, and document for every operation, you keep
the operation next to the code that uses it and let TypeScript infer a `TypedDocumentNode`.

The two approaches can coexist. Migrate one operation at a time, keep the existing generator for
unmigrated files, and remove its configuration only after the last generated import has gone.

## 1. Inventory the generated contract

Before changing code, locate:

- the GraphQL Code Generator configuration and its `schema`, `documents`, and `generates` entries;
- generated operation documents and `Result`/`Variables` imports;
- custom scalar mappings and TypeScript enum mappings;
- fragment-masking helpers from a generated client preset;
- CI scripts that run the generator or check its output.

Do not infer scalar types from their names. Copy mappings only after checking how your API
serializes each scalar.

## 2. Configure gql.tada

Install and configure [`gql.tada`](/get-started/installation). Point the TypeScript plugin at the
same schema source used by your generator and create a `.d.ts` output file:

```json [tsconfig.json]
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

Generate the schema typings and check the setup before migrating operations:

```sh
gql-tada generate output
gql-tada doctor
```

If you need custom scalars, initialize and export a project-local `graphql` function. Import this
function consistently in migrated files:

```ts [src/graphql.ts]
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql-env.d.ts';

export const graphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    ID: string;
    DateTime: string;
    JSON: unknown;
  };
}>();

export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada';
export { readFragment } from 'gql.tada';
```

Prefer `unknown` until the runtime representation of a scalar is known. Avoid `any` or a cast just
to make a migration compile.

## 3. Replace one generated operation

A generated document and its explicit generic types:

```ts [before.ts]
import { useQuery } from '@apollo/client/react';
import {
  GetPokemonDocument,
  type GetPokemonQuery,
  type GetPokemonQueryVariables,
} from './__generated__/graphql';

const result = useQuery<GetPokemonQuery, GetPokemonQueryVariables>(GetPokemonDocument, {
  variables: { id: '001' },
});
```

becomes a colocated typed document. The client infers both generics:

```ts [after.ts]
import { useQuery } from '@apollo/client/react';
import { graphql } from './graphql';

const GetPokemon = graphql(`
  query GetPokemon($id: ID!) {
    pokemon(id: $id) {
      id
      name
    }
  }
`);

const result = useQuery(GetPokemon, {
  variables: { id: '001' },
});
```

When another API genuinely needs the standalone types, derive them instead of recreating them:

```ts
import type { ResultOf, VariablesOf } from 'gql.tada';

type GetPokemonData = ResultOf<typeof GetPokemon>;
type GetPokemonVariables = VariablesOf<typeof GetPokemon>;
```

## 4. Migrate fragments with masking

Define each fragment next to the component that consumes it. Accept the opaque fragment reference
with `FragmentOf`, then call `readFragment()` inside that boundary:

```tsx [PokemonCard.tsx]
import type { FragmentOf } from 'gql.tada';
import { graphql, readFragment } from './graphql';

export const PokemonCardFragment = graphql(`
  fragment PokemonCard on Pokemon {
    id
    name
  }
`);

export function PokemonCard(props: {
  pokemon: FragmentOf<typeof PokemonCardFragment>;
}) {
  const pokemon = readFragment(PokemonCardFragment, props.pokemon);
  return <span>{pokemon.name}</span>;
}
```

Compose the fragment into its parent operation in two places: spread its GraphQL name and pass the
document in the second argument to `graphql()`.

```ts [PokemonList.tsx]
import { graphql } from './graphql';
import { PokemonCardFragment } from './PokemonCard';

const PokemonList = graphql(
  `
    query PokemonList {
      pokemons {
        id
        ...PokemonCard
      }
    }
  `,
  [PokemonCardFragment]
);
```

Do not copy a fragment's selected fields into a handwritten TypeScript interface and do not cast
query data to `FragmentOf`. Fragment composition creates the reference that the child accepts.

If an existing codebase cannot adopt masking immediately, `initGraphQLTada` supports
`disableMasking: true`, but treat it as a temporary migration option. Keeping masking enabled makes
component data dependencies explicit and generally reduces TypeScript inference work.

## 5. Preserve enum behavior deliberately

GraphQL enums normally become string-literal unions in `gql.tada`. If generated TypeScript enums are
part of an existing public interface, map them temporarily through the `scalars` option as described
in the [Recipebook](/guides/recipebook#working-with-enums). Remove that compatibility mapping as
call sites migrate rather than making emitted TypeScript enums the new default.

## 6. Validate each batch

After each group of operations:

```sh
gql-tada generate output
gql-tada check --fail-on-warn
tsc --noEmit
```

For a larger project, configure `tadaTurboLocation`, run `gql-tada turbo`, and commit the generated
cache if that matches your repository policy. Use the scanner to review the migrated document graph
and warnings:

```sh
gql-tada scan --format json --output gql-tada-scan.json
gql-tada scan --graph --output gql-tada-graph.json
```

The scan report can reveal orphan fragments, cross-feature fragment dependencies, deprecated field
usage, operation depth, and schema reach. It does not replace `gql-tada check` or `tsc`.

## 7. Remove the old generator last

Only after migrated application code and tests pass:

1. search for imports from generated modules;
2. remove obsolete generated files and generator scripts;
3. remove GraphQL Code Generator packages that have no remaining use;
4. update CI to run `gql-tada generate output`, `gql-tada check`, and optionally `gql-tada turbo`;
5. verify committed generated files with `git diff --exit-code` if your repository tracks them.

Keep GraphQL Code Generator if it still performs server-side generation or another unrelated task.
Migrating client operations does not require replacing every use of the generator at once.
