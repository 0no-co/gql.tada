---
'@gql.tada/cli-utils': patch
---

Preserve recursive input types in Turbo caches using shared named input aliases instead of emitting `any` at circular references. The cache file will change once for every document with input object variables, since these now reference the shared aliases.
