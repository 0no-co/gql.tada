---
'gql.tada': minor
---

Support `@_optional` and `@_required` directives on fields overriding the field types.
When used, `@_required` can turn a nullable type into a non-nullable, and `@_optional`
can turn non-nullable fields into nullable ones. (See [“Client-Controlled Nullability” in Graphcache for an example of a client implementing this.](https://formidable.com/open-source/urql/docs/graphcache/local-directives/#client-controlled-nullability))
