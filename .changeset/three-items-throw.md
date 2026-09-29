---
'@gql.tada/cli-utils': patch
---

Skip rewriting the output file when its contents are unchanged. `writeOutput()` always performed an atomic write and then forced `fs.utimes()` on the target to guarantee a change event, so file watchers reloaded even when `generate-output` and `turbo` produced no changes. The file is now left untouched when the generated contents match what is already on disk.
