---
'gql.tada': minor
---

Move testing functions API to `gql.tada/testing`, increasing separation. This isn't a breaking change as `maskFragments` and `unsafe_readResult` are (for now) re-exported from the main entrypoint
