---
"gql.tada": patch
---

Improve type inference performance of hot-path that computes fragment spreads. The `getFragmentsOfDocuments` type has been refactored and will now have a lower impact on performance.
