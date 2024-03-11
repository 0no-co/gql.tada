---
'gql.tada': patch
---

Replace redundant `$tada.ref` value on `$tada.fragmentRefs` definitions for masked fragments with typename string literal. The record for fragment masks is already namespaced, so there wasn't a need to use a symbol value here, and this further increases readability and usefulness.
