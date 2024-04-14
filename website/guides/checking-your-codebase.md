---
title: Check
description: How you can leverage the checks from the LSP outside of your coding process.
---

# Running checks

With the LSP plugin we have a workflow for development where you see errors for missing fields,
warnings for deprecated usage, ... By default this however only runs in your editor because
`typescript` does not run plugins as part of the `check` process.

With the tada CLI package we intend to fix this by providing a `check` command which can
be added to CI processes.

For instance, we can add a CI step in `github-actions` like

```yaml
- name: Build lambdas
  run: npx gql-tada check
```

The types of logs that you can receive

Errors:

- invalid selections
- wrong type-conditions
- unknown directives

Warnings

- using deprecated fields
- missing fragment imports (if turned on)
- missing document reference or hash on persisted operation
- missing operation-name

Info:

- unused fields (if turned on)
