---
'@gql.tada/cli-utils': patch
---

Fix `turbo` command's cache disabling override not being effective. This was a regression that meant the cached outputs would be reused during the next run of the `turbo` command.
