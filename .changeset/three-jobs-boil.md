---
"gql.tada": patch
---

Add `__typename` narrowing of unmasked interface fragment spreads, which could otherwise lead to confusion. This usually is relevant when the parent selection set forgets to include a `__typename` selection.
