---
"gql.tada": patch
---

Fix `@defer`, `@skip`, and `@include` optional fragments causing types to become exponentially more complex to evaluate, causing a recursive type error. Instead, merging field types and sub-selections from fragments is now separated, as needed.
