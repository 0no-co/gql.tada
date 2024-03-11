---
'gql.tada': patch
---

Allow `readFragment()` to accept the document as a generic rather than a (runtime value) argument. This replaces the complex mapping type for input arguments, and hence drops the (undocumented) support for nested arrays being passed to it.
