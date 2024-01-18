---
'gql.tada': patch
---

Prevent type inference for schemas with “huge” root types (i.e. types with an excessive amount of fields) from failing introspection mapping.
