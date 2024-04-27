---
title: Essential Workflows
description: How to get set up and ready
---

# Essential Workflows

## <span data-step="1">1.</span> Setup

<section>
  Before getting started, the <code>gql.tada</code> CLI has
  the <code>generate schema</code> and <code>doctor</code>
  commands to help with getting all set up.
</section>

### Downloading Schemas

The [`schema` setting](/reference/config-format#schema) supports
loading your GraphQL schema from an SDL or introspection file,
as well as making a GraphQL introspection request to a URL.

While this is convenient you may not want your schema to be
introspected from an API running locally or remotely indefinitely.
However, as you may not be maintaining your GraphQL API in the
same repository or your GraphQL server may not output an SDL
file itself, the `generate schema` CLI command exists to close
this gap.

To introspect an API and download your schema, run the `generate schema`
command while passing your API's URL.

```sh
gql.tada generate schema 'http://api.test/graphql' --output './schema.graphql'
```

When no `--output` argument is passed, the command will attempt to
use your configuration's `schema` setting, provided it's a file path.

<a href="/reference/gql-tada-cli#generate-schema" class="button">
  <h4>CLI Reference</h4>
  <p>Learn more about the <code>generate-schema</code> command</p>
</a>

---

### The `doctor` command

Since you've run through the steps on the [Installation
page](/get-started/installation), you may have seen that there
are several moving parts to `gql.tada`, including needing
an output file to be generated and relying on the `@0no-co/graphqlsp`
TypeScript plugin to display diagnostics.

To prevent any of these parts working improperly, and to detect
whether there are any issues in your configuration or with
your setup, the `doctor` command exists.

```sh
gql.tada doctor
```

The `doctor` command runs through several environemnt checks,
loads your configuration, and checks your schema to make sure
you don't run into any unexpected issues.

While it's entirely optional, it doesn't hurt to run it before
you get started or when onboarding a new team member onto
`gql.tada`.

## <span data-step="2">2.</span> Editing

<section>
  While editing, the TypeScript plugin will update
  the <code>gql.tada</code> output file and display diagnostics,
  but we can achieve the same using the <code>generate output</code>
  and <code>check</code> commands.
</section>

Usually while editing your code, the `@0no-co/graphqlsp` plugin
takes care of several things automatically:
- it generates the output typings file
- it provides type hints and suggestions
- it displays diagnostics when it detects a problem

However, you can also generate the output typings file
or get diagnostics outside of your editor. This is especially
important if you need diagnostics or the output file before
or without opening your editor, or if your editor does not
support TypeScript plugins.

### Generating the output file

As we've learned on the [Installation page](/get-started/installation#step-3-—-configuring-typings),
the output typings file is necessary for `gql.tada` to infer types
of GraphQL documents as it contains an introspection type of
your schema.

To generate the output typings file, use the `gql.tada` CLI's
`generate turbo` command.

```sh
gql.tada generate output
```

The `generate output` command loads your schema, generates
introspection output and finally saves the output typings file.

Just like the `@0no-co/graphqlsp` plugin, the command will
use the `tadaOutputLocation` setting to determine where to
write the output file to, and will load your schema
using the `schema` setting:

::: code-group
```json [tsconfig.json] {7}
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@0no-co/graphqlsp",
        "schema": "./schema.graphql"
        "tadaOutputLocation": "./src/graphql-env.d.ts"
      }
    ]
  }
}
```
:::

The output typings file essentially contains the regular introspection
data of your schema. If the format is changed from a `.d.ts` to a
`.ts` file, the introspection data is even reusable for runtime
code.
However, the `d.ts` file type is recommended as it's more efficient
for the TypeScript type checker for larger schemas. This format is
also preprocessed into an intermediary format.

<div class="column">
  <a href="/reference/config-format#tadaoutputlocation" class="button">
    <h4>Config Format</h4>
    <p>Learn more about the <code>tadaOutputLocation</code> setting</p>
  </a>
  <a href="/reference/gql-tada-cli#generate-output" class="button">
    <h4>CLI Reference</h4>
    <p>See more arguments the <code>generate-output</code> command accepts</p>
  </a>
</div>

::: info Should the output tyings file be committed?
You can decide yourself whether you want to check the output typings file
into version control.

Without the typings file, GraphQL types can't be inferred and you'll
get errors when running type checks, for example with the `tsc`
command.
Committing the output file to your repository has the advantage
that you'll always be in a state to run type checks.
:::

---

### Running diagnostics

All diagnostics that the `@0no-co/graphqlsp` runs, can also
be run using the CLI's `check` command. This is also useful to
run to get an idea of any issues across the entire codebase.

```sh
gql.tada check
```

The `check` command loads your schema then runs diagnostics
on your code. This includes both diagnostics specific to
`gql.tada` as well as GraphQL validation, and
checks against your GraphQL schema.

The GraphQL checks that are run are basically the same that
your GraphQL server would run during
[GraphQL Validation](https://graphql.org/learn/validation/).
For example, when you write a query that selects fields that
don't exist on your schema, or you pass invalid arguments
to a field an error will be displayed.

::: info Why doesn't `tsc` show me diagnostics?
TypeScript plugins are specific to the TypeScript language
service, and during other tasks, like in `tsc` or in other
tools that integrate with TypeScript, no plugins are loaded
or executed.

The diagnostics that are displayed in your editor by
`@0no-co/graphqlsp`, are specific to the `tsserver` and
to editors, and the `gql.tada check` command has been created
to get the same diagnostics outside of editors.
:::

Some diagnostics are specific to `gql.tada`, specifically
there's two settings you can change in your configuration:

- [`trackFieldUsage`](/reference/config-format#trackfieldusage)
- [`shouldCheckForColocatedFragments`](/reference/config-format#shouldcheckforcolocatedfragments)

<a href="/reference/gql-tada-cli#check" class="button">
  <h4>CLI Reference</h4>
  <p>Learn more about the CLI's <code>check</code> command</p>
</a>

## <span data-step="3">3.</span> Committing

<section>
  Before we commit and push our work, we can use the
  <code>turbo</code> command to speed up TypeScript's
  type checks for all our GraphQL documents.
</section>

`gql.tada` usually infers the types of GraphQL
documents entirely in TypeScript's type system.
It has types to parses documents and convert them
to types. If you worked with TypeScript before
you may have already spotted a problem here.

For each GraphQL document you add more, TypeScript's
type checker has more work to do, and over time
type checking will get slower and slower as your
codebase grows.

### Turbo Mode

To help with this and prevent performance issues,
the `gql.tada` CLI has a `turbo` command that
pre-processes types and outputs a type cache.

```sh
gql.tada turbo
```

The `turbo` command scans your codebase for GraphQL
documents and evaluates their TypeScript types ahead
of time. It will then write these types to a type cache,
which contains all your documents' pre-evaluated types.

You can update your configuration to change where this
type cache gets written to with the `tadaTurboLocation`
setting:

::: code-group
```json [tsconfig.json]
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@0no-co/graphqlsp",
        "schema": "./schema.graphql"
        "tadaOutputLocation": "./src/graphql-env.d.ts",
        "tadaTurboLocation": "./src/graphql-cache.d.ts" // [!code ++]
      }
    ]
  }
}
```
:::

If you inspect the written file, you'll see that it's a
regular `d.ts` typings file which contains a map of GraphQL
document strings, as they appear in your code, to TypeScript
type literals.

If you're familiar with GraphQL type generation tools, you
may recognize that this is essentially a compromise between
"codegen tools",
which [are explained further on the page on "Typed Documents"](/guides/typed-documents#type-generation),
and the pure type inference approach that
`gql.tada` takes out of the box.

::: info Should the type cache be committed?
You can decide yourself whether you want to check the type cache file
into version control.

Committing it to your repository has the advantage that when you
or someone else starts working on a new set of changes,
TypeScript's type checks will be as fast as they can be, which
can improve the Developer Experience on larger codebases.
:::

## <span data-step="4">4.</span> CI Checks

<section>
  For after we commit and push our work, we can set up our CI
  environment with the <code>gql.tada</code> CLI commands we've
  now seen to output files and run diagnostics.
</section>

Integrating the `gql.tada` CLI into your continuous integration
pipeline takes just adding a few commands and should effectively
replicate the errors you may see in an editor when using `gql.tada`.

At the very least, you'll likely want to run the `check` command in your
CI environment.

```sh
gql.tada generate output
gql.tada check
```

::: details GitHub Actions Example
If you're using GitHub Actions, you can run the commands in a simple step
in your workflow's jobs.

```yaml
- name: "gql.tada Checks"
  run: |
    gql.tada generate output
    gql.tada check
```

On GitHub Actions, the `check` command will also integrate with GitHub's,
and annotate errors and warnings inside the GitHub UI on pull requests,
for instance.
:::

The `generate output` command,
as [previously mentioned](#generating-the-output-file),
generates the typings output file and since this file is necessary for
type inference, if it's not generated and missing, running type
checks (for instance, with `tsc`) will likely fail with type errors.

### Uncommitted output files

As you've seen on this page, there are two different output files we're
concerned with when running inside an continuous integration environment.

- the output typings file (via [the `generate output` command](#generating-the-output-file))
- the type cache file (via [the `turbo` command](#turbo-mode))

Checking these files into your repository makes sure that your
codebase is less reliant on running `gql.tada`, and that anyone
who clones your code does not have to even know how to use
`gql.tada`.

This may mean however that you want to keep these files up-to-date
and check for them in your CI's checks as well.

```sh
gql.tada generate-output
gql.tada turbo
git diff --name-status --exit-code .
```

::: details GitHub Actions Example
If you're using GitHub Actions, you can run the commands in a simple step
in your workflow's jobs.

```yaml
- name: "gql.tada Checks"
  run: |
    gql.tada generate output
    gql.tada generate turbo
    git diff --name-status --exit-code .
```
:::

The `git diff` command added at the end will fail if any unstaged changes are
present. Adding this can help fail your CI step, if any of `gql.tada`'s
files need to be updated.
