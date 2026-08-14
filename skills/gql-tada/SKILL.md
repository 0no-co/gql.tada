---
name: gql-tada
description: Set up, migrate, debug, optimize, validate, or analyze TypeScript GraphQL projects that use or should use gql.tada. Use for gql.tada configuration, typed documents, fragment masking, GraphQL Code Generator migrations, client integrations, CLI diagnostics, Turbo Mode, persisted documents, or scan reports.
---

# gql.tada

Use gql.tada's schema-derived types and CLI feedback as the source of truth. Read
[`references/documentation.md`](references/documentation.md) for the task-specific documentation
map before making broad changes.

## Inspect first

1. Read the nearest `package.json`, applicable `tsconfig.json` files, and project references.
2. Find the existing `gql.tada/ts-plugin` or legacy `@0no-co/graphqlsp` entry.
3. Record `schema`, `tadaOutputLocation`, `tadaTurboLocation`, and
   `tadaPersistedLocation` where present.
4. Find whether the project exports a custom `graphql` function from `initGraphQLTada()` and use
   that function consistently.
5. Check existing fragments, generated-file policy, GraphQL client, framework support packages, and
   CI scripts.
6. Run `gql-tada doctor` before changing a broken setup.

Do not add duplicate configuration or assume the package-level `graphql` export is correct in a
custom or multi-schema project.

## Choose the workflow

### Install or configure

- Point the TypeScript plugin at a real SDL file, introspection JSON file, or introspectable URL.
- Configure a `.d.ts` `tadaOutputLocation` unless runtime schema data is required.
- Run `gql-tada generate output`, then `gql-tada doctor`.
- Map custom scalars only after verifying their serialized runtime representation. Prefer `unknown`
  over `any` when it is not known.

### Author documents

- Create operations and fragments with the project's `graphql` function.
- Let the resulting typed document infer client result and variables types; avoid explicit generics.
- For every fragment spread, pass its document in the second argument to `graphql()`.
- Accept component data with `FragmentOf<typeof Fragment>` and unwrap it with
  `readFragment(Fragment, data)` at the fragment owner.
- Preserve schema nullability rather than forcing data through non-null assertions or casts.

### Migrate from GraphQL Code Generator

- Inventory generated documents, explicit operation types, scalar/enum mappings, fragment helpers,
  and CI first.
- Migrate one operation at a time; generated and gql.tada documents may coexist.
- Replace generated result/variables imports and client generics with a gql.tada document.
- Move fragments to consumers, compose them explicitly, and adopt masking boundaries.
- Keep the old generator until no migrated application import depends on its output.

### Debug

Run, in order:

```sh
gql-tada doctor
gql-tada generate output
gql-tada check
```

Then check config ownership, schema resolution, inclusion of the generated `.d.ts`, custom
`graphql` imports, fragment composition, TypeScript workspace version, and Vue/Svelte support.
Remember that `tsc` does not run language-service plugin diagnostics; use `gql-tada check` as well.

### Optimize

- Update gql.tada and TypeScript.
- Prefer `.d.ts` schema output, smaller composed fragments, and fragment masking.
- Configure `tadaTurboLocation` and run `gql-tada turbo`.
- Follow the repository's policy before committing or ignoring the generated cache.

### Analyze and automate

Use versioned machine-readable output without changing source:

```sh
gql-tada doctor --format json --output gql-tada-doctor.json
gql-tada check --format json --output gql-tada-check.json
gql-tada scan --format json --output gql-tada-scan.json
gql-tada scan --graph --output gql-tada-graph.json
```

Check the report's top-level `version`. Treat findings as leads to inspect because `scan` is
experimental. Do not rewrite unrelated documents merely because they appear in reach or graph data.

## Hard constraints

- Never fabricate schema fields, nullability, enum values, scalar mappings, or introspection types.
- Never hand-edit `graphql-env.d.ts` or a Turbo cache.
- Do not use `as`, `any`, handwritten result interfaces, or `unsafe_readResult()` to hide an
  application typing error. For fixtures, prefer `maskFragments()` or `readResult()` from
  `gql.tada/testing`.
- Do not omit the fragment tuple when a document contains a fragment spread.
- Do not remove GraphQL Code Generator until its remaining responsibilities and imports are known.
- Do not claim `tsc` executes gql.tada diagnostics.

## Validate

Run the smallest relevant repository tests plus:

```sh
gql-tada generate output
gql-tada check --fail-on-warn
tsc --noEmit
```

If the repository tracks generated schema or Turbo files, regenerate them and inspect the diff. For
migrations or structural refactors, compare `gql-tada scan --format json` before and after.
