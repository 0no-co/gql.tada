---
'@gql.tada/cli-utils': patch
---

Scope the schema fingerprint in `turbo` document hashes to the parts of the schema each document can reach, so a schema change only invalidates the cached documents whose types it can affect, instead of every document in the cache.
