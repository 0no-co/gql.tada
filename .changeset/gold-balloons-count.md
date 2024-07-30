---
"@gql.tada/cli-utils": patch
---

Prevent `NodeNext` module resolution from being used over `Bundler` mode, since this is almost always a mistake.
