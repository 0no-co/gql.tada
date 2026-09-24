# gql.tada contributor guide for coding agents

## Project overview

This is a pnpm workspace for `gql.tada`, its supporting packages, examples, and VitePress website.

- `src/`: public library, TypeScript plugin entrypoint, and type-level tests
- `packages/cli-utils/`: CLI commands and programmatic CLI APIs
- `packages/internal/`: shared schema and configuration internals
- `packages/vue-support/` and `packages/svelte-support/`: external-file transforms
- `examples/`: framework integration fixtures
- `website/`: documentation and VitePress configuration

Read the nearest package's `package.json` and relevant source/tests before editing. Avoid loading or
rewriting the large generated fixture at `src/__tests__/fixtures/githubIntrospection.ts` unless the
task specifically requires it.

## Setup and checks

Use pnpm and preserve `pnpm-lock.yaml`:

```sh
pnpm install
pnpm check
pnpm lint
pnpm test
pnpm build
```

Prefer the smallest relevant check while iterating. Before finishing a source change, run its
package tests and TypeScript check. For documentation changes, run:

```sh
pnpm --filter @gql.tada/website-vitepress export
pnpm --filter @gql.tada/website-vitepress validate:agents
```

Type-level behavior is commonly tested in `*.test-d.ts` files. Runtime and CLI behavior uses Vitest
`*.test.ts` files. Preserve both kinds of coverage when changing public types and runtime behavior.

## Code and repository conventions

- TypeScript is strict; use single quotes, two spaces, and the repository's existing formatting.
- Prefer small changes that preserve public APIs and existing CLI aliases.
- Keep human terminal output and machine-readable output free of cross-contamination.
- Treat generated schema typings, Turbo caches, build output, and large introspection fixtures as
  generated artifacts; do not hand-edit them.
- Keep examples schema-backed. Do not invent fields, nullability, scalar mappings, or result types.
- Preserve fragment composition and masking semantics in documentation examples.
- Follow existing package boundaries instead of importing internal modules across packages.

## Documentation

Documentation lives in `website/` and is also generated as Markdown for agents. Add accurate
frontmatter `title` and `description` values to new pages, include them in the VitePress sidebar, and
ensure examples remain useful in `/llms-full.txt`. Use `<llm-exclude>` and `<llm-only>` sparingly when
Twoslash scaffolding would otherwise obscure an example.

## Changesets and pull requests

Add a changeset for user-visible changes to published packages. Documentation-only, test-only, and
internal maintenance changes generally do not need one. Follow `CONTRIBUTING.md` for the final
changeset and pull-request policy.
