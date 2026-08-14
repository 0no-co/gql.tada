---
title: Agentic Workflows
description: A safe workflow for coding agents to inspect, configure, migrate, analyze, and validate gql.tada projects.
---

# Agentic Workflows

Coding agents can use gql.tada's schema, TypeScript integration, diagnostics, and scanner to make
GraphQL changes with the same constraints as a developer's editor. The safest workflow is to inspect
first, make a small change, and validate it against both GraphQL and TypeScript.

For reusable instructions, this repository also provides an open-standard
[`gql-tada` Agent Skill](https://github.com/0no-co/gql.tada/tree/main/skills/gql-tada).
Raw Markdown documentation is available through
[`/llms.txt`](https://gql-tada.0no.co/llms.txt) and individual `.md` routes.

## 1. Inspect before changing configuration

Locate and read:

- the nearest `package.json` and installed `gql.tada` version;
- applicable `tsconfig.json` files and project references;
- the `gql.tada/ts-plugin` or legacy `@0no-co/graphqlsp` plugin entry;
- `schema`, `tadaOutputLocation`, `tadaTurboLocation`, and `tadaPersistedLocation`;
- a project-local `graphql` export created with `initGraphQLTada()`;
- existing fragment composition, generated output policy, and CI commands.

Do not add a second plugin entry or replace a custom `graphql` function with the package export.
Multi-schema projects intentionally have separate functions and output files.

Run a non-destructive setup check:

```sh
gql-tada doctor
```

## 2. Establish the source of truth

Use the project's configured schema. Do not invent GraphQL fields, nullability, scalar mappings, or
enum values from nearby TypeScript types. If schema loading is broken, fix that before authoring a
document.

Refresh the generated schema typings when necessary:

```sh
gql-tada generate output
```

Treat `graphql-env.d.ts` and Turbo caches as generated files. Do not patch them manually.

## 3. Follow the document and fragment conventions

Create documents with the project's `graphql` function. Let the document carry result and variables
types into the client instead of adding explicit generics.

When a document spreads a fragment, always pass the fragment document to the second argument:

```ts
const PokemonCard = graphql(`
  fragment PokemonCard on Pokemon {
    id
    name
  }
`);

const PokemonList = graphql(
  `
    query PokemonList {
      pokemons {
        id
        ...PokemonCard
      }
    }
  `,
  [PokemonCard]
);
```

At the consuming boundary, use `FragmentOf` and `readFragment()`:

```ts
import { readFragment, type FragmentOf } from 'gql.tada';

function getName(data: FragmentOf<typeof PokemonCard>) {
  return readFragment(PokemonCard, data).name;
}
```

Do not bypass an error with `as`, `any`, `unsafe_readResult()`, a hand-written result interface, or a
fabricated introspection type. In tests, prefer the type-safe helpers from `gql.tada/testing`.

## 4. Use task-specific workflows

### Add or edit an operation

1. inspect the schema and adjacent documents;
2. preserve the local naming and colocation pattern;
3. compose every spread fragment in the second argument;
4. pass the typed document directly to the GraphQL client;
5. run `gql-tada check` and the repository's TypeScript tests.

### Migrate generated operations

Migrate incrementally. Keep GraphQL Code Generator for untouched documents, transfer verified scalar
and enum mappings, and remove explicit client generics as typed documents replace generated ones.
Follow [Migrating from GraphQL Code Generator](/guides/migrating-from-codegen).

### Diagnose setup or inference

Run:

```sh
gql-tada doctor
gql-tada generate output
gql-tada check
```

Then follow the ordered checks in [Troubleshooting](/guides/troubleshooting). A TypeScript cast is not
a configuration fix.

### Improve inference performance

Keep output in `.d.ts`, compose smaller fragments, preserve masking, configure `tadaTurboLocation`,
and run:

```sh
gql-tada turbo
```

Do not add Turbo before confirming the current repository's generated-file policy.

## 5. Analyze an unfamiliar codebase

`scan` connects source modules, GraphQL documents, fragments, and schema coordinates. Start with the
machine-readable report:

```sh
gql-tada scan --format json --output gql-tada-scan.json
```

For dependency or visualization work, emit the relationship graph:

```sh
gql-tada scan --graph --output gql-tada-graph.json
```

Useful report areas include:

- operation and fragment identities with source locations;
- deprecated field use;
- orphan and cross-feature fragments;
- field, enum value, and input-field reach;
- operation complexity and fetch depth;
- directive usage.

The JSON report has a top-level `version`; check it before parsing because `scan` is experimental.
A scan warning is evidence to inspect, not permission to rewrite unrelated features.

## 6. Validate the smallest relevant change

At minimum, run:

```sh
gql-tada generate output
gql-tada check --fail-on-warn
tsc --noEmit
```

Also run project tests that exercise the changed client or component. If the repository commits
schema typings or Turbo output, regenerate them and inspect the diff rather than silently discarding
it.

For a migration or refactor, compare scan reports before and after. Confirm that intended operations
remain, fragment references resolve, and no unrelated schema reach changed.

## Command map

| Goal | Command |
| --- | --- |
| Check installation and schema loading | `gql-tada doctor` |
| Export setup checks as JSON | `gql-tada doctor --format json` |
| Regenerate schema typings | `gql-tada generate output` |
| Run GraphQL diagnostics | `gql-tada check --fail-on-warn` |
| Export diagnostics as JSON | `gql-tada check --format json` |
| Cache inferred document types | `gql-tada turbo` |
| Analyze documents as JSON | `gql-tada scan --format json` |
| Export relationships as JSON | `gql-tada scan --graph` |
| Generate a persisted manifest | `gql-tada generate persisted` |

Use `--tsconfig path/to/tsconfig.json` on commands that support it when project discovery is
ambiguous. Consult the [CLI reference](/reference/gql-tada-cli) before assuming an option exists.
