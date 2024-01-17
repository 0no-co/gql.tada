---
'gql.tada': patch
---

Make `$tada.fragmentRefs` property required. Previously, this was optional (to mirror what GCG’s client-preset does). However, this can lead to invalid checks in `readFragment`, as it would be able to match types that don’t actually match the fragment refs.
