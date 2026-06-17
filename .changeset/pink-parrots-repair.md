---
'@gql.tada/cli-utils': patch
'@gql.tada/internal': patch
---

Refine how `references` are walked and when they conflict. We should only check references if we haven't yet found a plugin entry, and allow duplicate entries, if their output locations don't conflict.
