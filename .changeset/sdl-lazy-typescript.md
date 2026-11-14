---
'@gql.tada/internal': patch
---

Load `typescript` lazily in `loadFromSDL`, only to watch schema files, and fall back to `fs.watch` when its compiler API isn't available. `@gql.tada/internal` can now be imported in projects that use `typescript@7`, which doesn't expose the compiler API, or that only have tsrs installed.
