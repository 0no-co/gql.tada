---
'gql.tada': patch
---

Fix `readFragment()` not inferring the types of complex fragments, i.e. fragments that derive with a union type.
