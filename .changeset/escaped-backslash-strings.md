---
'gql.tada': patch
---

Fix the type-level tokenizer treating a string's closing quote as escaped when it follows an escaped backslash (e.g. `"C:\\"`), which made the whole document's result type `never`.
