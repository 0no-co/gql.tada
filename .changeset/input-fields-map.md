---
'gql.tada': major
'@gql.tada/internal': major
---

Key input objects' `inputFields` by field name, rather than listing them in a tuple, in the schema format that `gql.tada` reads and `@gql.tada/internal` outputs. Output files (`tadaOutputLocation`) must be regenerated after upgrading, e.g. with `gql.tada generate output`. Types of variables resolve the same, and input objects are cheaper to type check.
