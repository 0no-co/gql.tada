---
"gql.tada": patch
---

Extend `readFragment` types to allow `| {}` optional fragments to be matched. When a fragment is annotated with a directive making it optional (such as `@include`, `@skip`, or `@defer`) then its typed as optional. `readFragment` previously didn't know how to match these types, but it will now match `T | {}` and infer the type as such.
