---
'@gql.tada/cli-utils': patch
---

Emit `turbo` cache entries and imports in a stable sorted order. The cache file's contents now only depend on the set of discovered documents rather than file traversal order, which keeps the output stable across refactors and reduces merge conflicts in committed cache files. Existing cache files will be reordered once when `gql-tada turbo` is next run.
