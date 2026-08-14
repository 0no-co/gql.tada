# gql.tada documentation map

Prefer the Markdown routes below when retrieving documentation for a task.

## Start and configure

- [Installation](https://gql-tada.0no.co/get-started/installation.md)
- [Writing GraphQL](https://gql-tada.0no.co/get-started/writing-graphql.md)
- [Essential workflows](https://gql-tada.0no.co/get-started/workflows.md)
- [Configuration format](https://gql-tada.0no.co/reference/config-format.md)

## Task guides

- [Migrate from GraphQL Code Generator](https://gql-tada.0no.co/guides/migrating-from-codegen.md)
- [Apollo Client, urql, and graphql-request](https://gql-tada.0no.co/guides/client-integrations.md)
- [Troubleshooting and performance](https://gql-tada.0no.co/guides/troubleshooting.md)
- [Agentic workflows](https://gql-tada.0no.co/guides/agentic-workflows.md)
- [Multiple schemas](https://gql-tada.0no.co/guides/multiple-schemas.md)
- [Testing masked data](https://gql-tada.0no.co/guides/testing.md)
- [Persisted documents](https://gql-tada.0no.co/guides/persisted-documents.md)

## Reference

- [gql.tada API](https://gql-tada.0no.co/reference/gql-tada-api.md)
- [CLI](https://gql-tada.0no.co/reference/gql-tada-cli.md)
- [Complete LLM bundle](https://gql-tada.0no.co/llms-full.txt)

## Command semantics

- `doctor` checks setup and schema loading; use `doctor --format json` for a versioned report.
- `generate output` writes schema typings to `tadaOutputLocation`.
- `check` runs GraphQL and gql.tada diagnostics; use `check --format json` for structured diagnostics and run it in addition to `tsc`.
- `turbo` writes a document type cache to `tadaTurboLocation`.
- `scan --format json` emits a versioned experimental analysis report.
- `scan --graph` emits only the relationship graph as JSON.
