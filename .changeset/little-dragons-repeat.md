---
'gql.tada': minor
---

Add support for `@_unmask` directive on fragments causing the fragment type to not be masked. `FragmentOf<>` will return the full result type of fragments when they’re annotated with `@_unmask` and spreading these unmasked fragments into parent documents will use their full type.
