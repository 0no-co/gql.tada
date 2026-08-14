---
title: Troubleshooting
description: Diagnose gql.tada configuration, missing types, GraphQL diagnostics, and TypeScript performance problems.
---

# Troubleshooting

Start with the CLI rather than changing types or adding casts:

```sh
gql-tada doctor
gql-tada generate output
gql-tada check
```

`doctor` checks dependencies, TypeScript and editor setup, configuration, external-file support, and
schema loading. `generate output` refreshes the schema typings. `check` runs GraphQL and gql.tada
diagnostics outside the editor.

## Types are `unknown`, empty, or not inferred

Check these in order:

1. Confirm that the plugin entry is under `compilerOptions.plugins` in the `tsconfig.json` that owns
   the source file.
2. Confirm that `schema` resolves from that config and that `tadaOutputLocation` is writable.
3. Run `gql-tada generate output` and inspect whether the configured file was created.
4. Ensure the output `.d.ts` is included by TypeScript and is not excluded by another config.
5. If using `initGraphQLTada`, import the generated `introspection` type and use the project-local
   `graphql` export in application files.
6. Restart the TypeScript language service after changing plugin configuration.

A minimal configuration is:

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

Do not hand-edit `graphql-env.d.ts`; regenerate it from the schema.

## The editor has no GraphQL completion or diagnostics

The TypeScript plugin supplies editor features, but `tsc` does not load language-service plugins.
Use `gql-tada check` for command-line diagnostics.

In VS Code:

- use the workspace TypeScript version;
- reload the TypeScript project after installation;
- install GraphQL syntax highlighting if desired;
- make sure another GraphQL language extension is not also analyzing `graphql()` strings with an
  incompatible schema configuration.

Run `gql-tada doctor` after changing the editor setup.

## The schema cannot be loaded

The `schema` option accepts GraphQL SDL, introspection JSON, or an introspectable URL. Paths are
resolved relative to the applicable TypeScript configuration.

For authenticated or intermittently available APIs, download a schema explicitly instead of making
every tool startup depend on the endpoint:

```sh
gql-tada generate schema https://api.example.test/graphql \
  --header "Authorization: $GRAPHQL_TOKEN" \
  --output ./schema.graphql
```

Then point `schema` at `./schema.graphql` and commit or refresh it according to your repository's
policy. Never put a secret value directly in `tsconfig.json` or documentation.

## A fragment spread is unknown or its fields are hidden

A spread must be composed into `graphql()` using the second argument:

```ts
const PokemonName = graphql(`
  fragment PokemonName on Pokemon {
    name
  }
`);

const Pokemon = graphql(
  `
    fragment Pokemon on Pokemon {
      id
      ...PokemonName
    }
  `,
  [PokemonName]
);
```

With fragment masking, the parent sees a fragment reference rather than the child's selected fields.
Accept it with `FragmentOf<typeof PokemonName>` and unwrap it with
`readFragment(PokemonName, data)` inside the component that owns the fragment.

Do not solve a missing fragment reference with `as`, `any`, or a duplicate TypeScript interface.
See [Fragment Colocation](/guides/fragment-colocation) for the complete pattern.

## `tsc` does not show gql.tada diagnostics

This is expected. TypeScript does not execute language-service plugins during `tsc`. Run both:

```sh
gql-tada check --fail-on-warn
tsc --noEmit
```

The first command validates GraphQL and gql.tada-specific rules; the second validates the resulting
TypeScript program.

## Vue or Svelte files are skipped

Install the matching support package so the CLI can parse external files:

```sh
# Choose the package for the framework in use:
pnpm add -D @gql.tada/vue-support
pnpm add -D @gql.tada/svelte-support
```

Then rerun `gql-tada doctor` and `gql-tada check`. Ensure the project's TypeScript configuration
actually includes the `.vue` or `.svelte` files.

## TypeScript is slow or reports excessive type instantiation

`gql.tada` infers documents in TypeScript's type system, so large projects should reduce repeated
inference work:

1. update `gql.tada` and TypeScript;
2. use a `.d.ts` `tadaOutputLocation`, not `.ts`, unless runtime introspection is required;
3. split very large operations into colocated fragments;
4. keep fragment masking enabled where practical;
5. configure a cache and run Turbo Mode.

```json [tsconfig.json]
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "gql.tada/ts-plugin",
        "schema": "./schema.graphql",
        "tadaOutputLocation": "./src/graphql-env.d.ts",
        "tadaTurboLocation": "./src/graphql-cache.d.ts"
      }
    ]
  }
}
```

```sh
gql-tada turbo
```

Commit the cache if your repository expects a fast, immediately type-checkable checkout. Refresh it
when GraphQL documents change.

## Diagnose a large or unfamiliar project

Create a machine-readable report without modifying source files:

```sh
gql-tada scan --format json --output gql-tada-scan.json
gql-tada scan --graph --output gql-tada-graph.json
```

The report includes operations, fragments, source locations, rule datapoints, and project totals.
The graph contains module, document, fragment, and schema relationships. Since `scan` is
experimental, check the output `version` before depending on a particular shape.

Use scan findings to prioritize investigation; confirm source changes with `gql-tada check` and
TypeScript.

## CI output files keep changing

Choose whether `graphql-env.d.ts` and the Turbo cache are committed, document the policy, and enforce
it consistently. For committed outputs:

```sh
gql-tada generate output
gql-tada turbo
git diff --exit-code -- src/graphql-env.d.ts src/graphql-cache.d.ts
```

Avoid mixing editor-generated files from one schema or config with CI-generated files from another.
For monorepos, pass `--tsconfig` when automatic config discovery is ambiguous.

## Still stuck

Capture the following before opening a discussion or bug report:

- `gql.tada`, TypeScript, GraphQL client, and framework versions;
- the relevant plugin configuration with secrets removed;
- `gql-tada doctor` and `gql-tada check` output;
- a minimal schema and document that reproduce the behavior;
- whether the issue occurs in the editor, CLI, `tsc`, or all three.

Questions belong in [GitHub Discussions](https://github.com/0no-co/gql.tada/discussions), while
reproducible bugs belong in [GitHub Issues](https://github.com/0no-co/gql.tada/issues).
