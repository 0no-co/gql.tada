---
title: Workflow
description: How does gql.tada and its LSP fit into your workflow?
---

# Workflow

There are some general workflows that are distinct locally (i.e. the LSP can take care of it)
vs remotely. In this guide we'll look at how we can get local/remote to being consistent.

> [!NOTE]
>
> This assumes that every `gql.tada` file is checked into VC.

## Staying up to date

There is a risk to go out of date when i.e. the schema is externally updated or when the LSP
isn't running. Out of date could mean that the server has changed the schema, that the tada-output
wasn't updated with the new schema or that the new persisted-operations weren't generated.

To avoid running into this issue we encourage folks to leverage the `generate-schema`, `generate-persisted` and `generate-output`
CLI commands. You can leverage these in CI and check whether a diff is present. 

An example could look like the following

```yaml
- name: Verify schema and tada types are up to date
  run: |
    npx gql-tada generate-schema http://example.com
    npx gql-tada generate-output -c ./tsconfig.json
    npx gql-tada generate-persisted ./persisted-ops.json
    git diff --name-only --exit-code -- .
```

Now if any of these files has a `git diff` attached to it the process will exit and you are notified
about the inconsistency.

## Diagnostics

With the LSP plugin `gql.tada` offers a workflow for development where you see errors for missing fields,
warnings for deprecated usage, ...

By default this however only runs in your editor because `typescript` does not run plugins as
part of the `tsc` process.

With the tada CLI package we intend to offer a solution by providing a `check` command which can
be added to CI processes or be run locally outside of your editor.

For instance, we can add a CI step in `github-actions` like

```yaml
- name: Build lambdas
  run: npx gql-tada check
```

By default the `check` command will exit with an error when we see an error, you can enable
it to also do that on warning by adding `--fail-on-warn`. You can read more about the options
in [LSP Config](../reference/gql-tada-cli.md#check).

The types of logs that you can receive

Errors

- invalid selections
- wrong type-conditions
- unknown directives

Warnings

- using deprecated fields
- missing fragment imports (if turned on in the [LSP Config](../reference/graphqlsp-config.md))
- missing document reference or hash on persisted operation
- missing operation-name

Info

- unused fields (if turned on in the [LSP Config](../reference/graphqlsp-config.md))

## Caching types

Having everything generate at runtime is pretty demanding on your machine, hence the `gql.tada` CLI
comes with a `turbo` command which will go over all the types in your codebase and pre-generate the types.

This way when you start working on your next feature, bug, ... TypeScript will only re-evaluate
the GraphQL documents you are changing rather than having to evaluate everything all the time.

We advise you to check-in the cache to Version-Control to both speed up your CI as well as enable
other developers to benefit from the cache.

This functionality could be great to add this as a pre-commit hook or run it manually with

```sh
npx gql-tada turbo -c ./tsconfig.json -o ./src/graphql/graphql-cache.d.ts
```
