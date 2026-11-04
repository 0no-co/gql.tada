---
'@gql.tada/cli-utils': patch
---

Ignore CRLF line endings in the `tadaOutputLocation` file when fingerprinting the schema for `turbo` document hashes, so that Windows and Unix checkouts of the same output file no longer invalidate each other's cached document types.
