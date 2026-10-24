---
'@gql.tada/cli-utils': minor
---

Support `gql.tada check` on TypeScript 7.1 and tsrs. With `typescript@>=7` installed, or only `tsrs`, documents are checked with `@0no-co/graphqlsp/check` on TypeScript's new programmatic API, since TypeScript 7 doesn't expose the compiler API. Use `--compiler tsrs` to check with tsrs when both are installed. This requires `@0no-co/graphqlsp@>=1.18.0`.
