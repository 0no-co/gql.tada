---
'@gql.tada/cli-utils': patch
---

Prevent OOM on `turbo` run of TypeScript evaluations, by reinstantiating the type checker and program when the heap is close to reaching a memory limit
