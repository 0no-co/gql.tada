---
"@gql.tada/cli-utils": patch
---

Add a warning if `.vscode/settings.json` doesn't contain setting to prompt to use the workspace TS version. This will only be shown if either VSCode is installed or a `.vscode/extensions.json` exists, as all other VSCode-related warnings.
