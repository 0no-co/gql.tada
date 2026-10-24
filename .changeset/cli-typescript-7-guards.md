---
'@gql.tada/cli-utils': patch
---

Report that `gql.tada turbo`, `generate persisted` and `scan` don't support TypeScript 7 yet, instead of crashing with a `TypeError`. `gql.tada doctor` now notes that TypeScript 7 doesn't load the GraphQLSP plugin. Unexpected errors now exit with a non-zero exit code.
