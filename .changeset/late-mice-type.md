---
"@gql.tada/cli-utils": minor
"gql.tada": minor
---

Support a second argument in `graphql.persisted` which accepts a `TadaDocumentNode` rather than passing a generic. This allows the document node to not be hidden, to still generate `documentId` via `gql.tada` without having to hide the document during runtime.
