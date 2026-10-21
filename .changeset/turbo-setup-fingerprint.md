---
'@gql.tada/cli-utils': patch
---

Include the `initGraphQLTada` setup in `turbo` document hashes, so changing a scalar mapping (including what an imported scalar type resolves to) or `disableMasking` invalidates the affected cached document types instead of reusing stale ones.
