---
'gql.tada': patch
'@gql.tada/cli-utils': patch
'@gql.tada/internal': patch
'@gql.tada/vue-support': patch
'@gql.tada/svelte-support': patch
---

Allow TypeScript 7.1 prereleases (e.g. `typescript@7.1.0-beta`) as peer dependencies, which `^7.0.0` doesn't match, and make the `typescript` peer dependency optional for projects that only use tsrs.
