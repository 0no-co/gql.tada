---
'@gql.tada/internal': minor
'@gql.tada/cli-utils': minor
---

Support `references` in `tsconfig.json` files (TypeScript project references). The new `loadConfigs` API in `@gql.tada/internal` resolves the root tsconfig and all transitively referenced projects that contain a plugin entry, and all CLI commands (`check`, `turbo`, `generate-output`, `generate-persisted`, `generate-schema`, `doctor`, `init`) now run for every resolved project. This makes the CLI work out-of-the-box with Vite/Vue/Nuxt templates, which use a solution-style root `tsconfig.json` that only references `tsconfig.app.json` and `tsconfig.node.json`, and with monorepos where multiple referenced projects each set up their own gql.tada plugin configuration. An error is raised when two projects resolve `tadaOutputLocation`, `tadaTurboLocation`, or `tadaPersistedLocation` to the same file.

Note for setups placing the plugin entry in an `extends`-ed base tsconfig: the CLI now derives each project's file list from the project's own `tsconfig.json` (letting TypeScript merge `extends` chains) rather than from the base file the plugin entry was found in, and `extends` is now resolved relative to each config file rather than the root config's directory. Relative output locations now also resolve from the project's `tsconfig.json` directory.
