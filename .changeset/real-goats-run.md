---
'gql.tada': patch
---

Refactor internal GraphQL document parser to use a tokenizer phase, which further utilizes TypeScript’s tail recursion optimization. This should help to further improve type inference performance.
