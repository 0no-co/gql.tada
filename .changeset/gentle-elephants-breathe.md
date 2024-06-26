---
"@gql.tada/cli-utils": patch
---

Fix regression omitting the exit status code from the CLI. Failing commands will now correctly output exit code `1` instead of `0` again.
