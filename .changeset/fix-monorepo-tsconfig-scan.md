---
'@gql.tada/cli-utils': patch
---

Fix `programFactory` scanning the entire monorepo when the `@0no-co/graphqlsp` plugin is declared in a shared root tsconfig that individual projects extend.
