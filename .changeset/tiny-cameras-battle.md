---
'gql.tada': patch
---

Remove redundant constraint on `IntrospectionQuery` data. When the full type is used as an `extends`, the input type (which can be a huge schema), is checked against this type, which forces a full evaluation. This means that TypeScript may spend multiple seconds in `recursiveTypeRelatedTo`. This work has been eliminated and should help performance.
