# TypeScript 7.1 native API compatibility

Run `pnpm check:ts-native-api` with the pinned `typescript-native` development alias.
The fixture intentionally contains one invalid assignment; do not include it in
the normal root typecheck or expect standalone `tsc -p` to exit successfully.

This is a compiler-facing compatibility test, not a native CLI implementation.
It uses the 7.1 beta's public `sync`,
`fs`, and `ast/is` entry points, `createSnapshot`, and `getConfiguredProject`.
Programs, snapshots, and the API are disposed explicitly.

The check verifies:

- literal interpolation and exact nullable list/item result inference;
- masked fragments, `readFragment`, and explicitly unmasked fragments;
- nullable optional, required, and defaulted variables, with rejected inputs;
- interface/abstract selections with discriminated concrete result unions;
- the exact source span/code of an intentional TypeScript semantic error;
- an in-memory snapshot update that clears the error without changing the prior snapshot.

The fixture excludes ambient `@types` packages and checks dependency declarations
(`skipLibCheck: false`). This avoids unrelated Node/DOM declaration conflicts
while testing gql.tada's actual types. The normal root `tsc --noEmit` remains the
broader source/type-test compatibility gate.

## Scope and installation

The alias is pinned to `typescript@7.1.0-beta`. At the time of this investigation,
the release was younger than pnpm 11's minimum-release-age policy. A fresh frozen
install can therefore be blocked until that policy window expires. Do not weaken
supply-chain policy to run this check. No policy exemptions are retained here.

Passing this check means **type inference and the tested native API operations**
work. It does not mean the CLI's existing TypeScript host has been ported. In an
isolated built-package consumer, both `generate-output` and `turbo` fail with
native TypeScript as their host because `parseConfigFileTextToJson` is absent.
The CLI also uses legacy `createLanguageService`/`createProgram` APIs. Generated
output/cache produced with the legacy host does typecheck with the beta.

Do not broaden peer ranges across CLI/internal packages on this evidence alone.
Also, the prerelease range in the older PR (`>=7.1.0-dev.20260815.1 <7.2.0`)
does not accept `7.1.0-beta` under npm semver ordering. Compiler compatibility,
CLI migration, and editor/GraphQLSP integration need separate support statements.
