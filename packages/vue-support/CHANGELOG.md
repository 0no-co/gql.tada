# @gql.tada/vue-support

## 1.0.3

### Patch Changes

- Support @vue/language-core version 3.0.0. This fixes compatibility issues with projects having a dependency on vue-tsc@3.x (through the transitive dependency of entities, which changed it's exports)
  Submitted by [@KammererTob](https://github.com/KammererTob) (See [#525](https://github.com/0no-co/gql.tada/pull/525))
- Prepare TypeScript compatibility checks for TS 6 latest and the native `tsgo` preview by modernizing tsconfig module resolution and widening TypeScript peer ranges through TS 8
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#522](https://github.com/0no-co/gql.tada/pull/522))

## 1.0.2

### Patch Changes

- Add support for TS v6 in peer-deps
  Submitted by [@JoviDeCroock](https://github.com/JoviDeCroock) (See [#514](https://github.com/0no-co/gql.tada/pull/514))

## 1.0.1

### Patch Changes

- Add per-package readme files
  Submitted by [@kitten](https://github.com/kitten) (See [#363](https://github.com/0no-co/gql.tada/pull/363))
