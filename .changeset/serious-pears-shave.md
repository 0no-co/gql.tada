---
'gql.tada': patch
---

Keep the possible types that are iterated through narrow through repeated abstract type fragment spreads, and provide an optional `__typename?: PossibleType` field by default so the type checker has an exact property to merge types on.
