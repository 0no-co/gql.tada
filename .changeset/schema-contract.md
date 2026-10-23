---
'gql.tada': minor
---

Add a schema contract, `TadaSchema` and its helper types, that schema builders may emit to type documents without introspection or code generation. Clients pass `IntrospectionOf<typeof schema>` to `initGraphQLTada()` when a builder attaches the type to its schema object.
