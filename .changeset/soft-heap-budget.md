---
'@gql.tada/cli-utils': patch
---

Scale turbo's soft heap limit with V8's configured heap budget so that larger
TypeScript programs can use an explicitly increased Node heap without rebuilding
the checker before every file.
