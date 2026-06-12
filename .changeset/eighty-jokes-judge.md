---
'@gql.tada/cli-utils': patch
'gql.tada': patch
---

Upgrade `@0no-co/graphqlsp` to `^1.16.0` and use `findAllCallExpressions`' new `collectFragments: false` option in the `turbo` command, replacing the plugin-info proxy that previously disabled fragment definition lookups. This also picks up graphqlsp's memoized gql.tada type probe, which reduces type checker work for non-GraphQL calls during call discovery
