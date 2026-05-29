---
'@gql.tada/vue-support': patch
'gql.tada': patch
'@gql.tada/cli-utils': patch
---

Support @vue/language-core version 3.0.0. This fixes compatibility issues with projects having a dependency on vue-tsc@3.x (through the transitive dependency of entities, which changed it's exports)
