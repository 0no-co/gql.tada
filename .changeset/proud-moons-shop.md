---
'@gql.tada/cli-utils': patch
---

Speed up `turbo` call discovery by caching module resolution for `graphql()` import-source tracing (one compiler host and resolution cache per run, memoized per file and identifier) and by skipping fragment definition lookups in `findAllCallExpressions`, whose output the `turbo` command discards
