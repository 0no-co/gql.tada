---
"@gql.tada/cli-utils": minor
"gql.tada": minor
---

Support a second argument in `graphql.persisted` which represents the `DocumentNode` to create the possibility of persisted-operations that still lock down the origin. Before this change we had to advise folks to use APQ.
