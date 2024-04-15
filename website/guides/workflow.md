---
title: Workflow
description: How does gql.tada and its LSP fit into your wofklow?
---

# Workflow

## Staying up to date

There is a risk to go out of date when i.e. the schema is externally updated or when the LSP
isn't running. For this we encourage folks to leverage the `generate-schema` and `generate-output`
CLI commands, you can leverage these in CI and check whether a diff is present, an example could
be something like the following

```yaml
- name: Verify schema and tada types are up to date
  run: npx gql-tada generate-schema http://example.com && npx gql-tada generate-output -c ./tsconfig.json && git diff --name-only --exit-code -- .
```

## Diagnostics

With the LSP plugin we have a workflow for development where you see errors for missing fields,
warnings for deprecated usage, ... By default this however only runs in your editor because
`typescript` does not run plugins as part of the `check` process.

With the tada CLI package we intend to fix this by providing a `check` command which can
be added to CI processes.

For instance, we can add a CI step in `github-actions` like

```yaml
- name: Build lambdas
  run: npx gql-tada check
```

By default the `check` command will exit with an error when we see an error, you can enable
it to also do that on warning by adding `--fail-on-warn`

The types of logs that you can receive

Errors:

- invalid selections
- wrong type-conditions
- unknown directives

Warnings

- using deprecated fields
- missing fragment imports (if turned on in the [LSP Config](../reference/graphqlsp-config.md))
- missing document reference or hash on persisted operation
- missing operation-name

Info:

- unused fields (if turned on in the [LSP Config](../reference/graphqlsp-config.md))

## Caching types

Having everything generate at runtime is pretty demanding on your machine, hence we introduced
a `turbo` command which will go over all the types in your codebase and pre-generate the types.
This way when you start working on your next feature, bug, ... TypeScript will only re-evaluate
the GraphQL documents you are changing rather than everything.

We advise you to check-in the cache to Version-Control to both speed up your CI as well as enable
other developers to benefit from it. Hence it could be great to add this as a pre-commit hook or
run it manually with

```sh
npx gql-tada turbo -c ./tsconfig.json -o ./src/graphql/graphql-cache.d.ts
```
