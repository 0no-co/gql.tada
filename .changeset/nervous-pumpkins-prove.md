---
"@gql.tada/internal": patch
---

Derive supported GraphQL features from introspection result, when the introspection support query fails. This works around issues for APIs that block `__type` unintentionally, but do allow for `__schema` introspection.
