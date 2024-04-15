---
"gql.tada": patch
"@gql.tada/cli-utils": patch
---

Fix `turbo` command reusing previously cached turbo typings. Instead, we now set a flag to disable the cache temporarily inside the command.
