---
title: Recipebook
description: A collection of tips, tricks, and patterns for common gql.tada use-cases.
---

# Recipebook

<section>
  A collection of miscellaneous patterns that work well with <code>gql.tada</code>.
</section>

## Customizing Scalars

By default, `gql.tada` maps the [built-in GraphQL scalars](https://spec.graphql.org/October2021/#sec-Scalars.Built-in-Scalars)
to their TypeScript equivalents, and maps any custom scalars it doesn't recognize
to `unknown`. The `scalars` option on `initGraphQLTada<>()` overrides either of
these.

### Overriding scalar types

The same `scalars` option maps both built-in and custom scalars to whatever
TypeScript type matches what your API serializes.

A common adjustment is the built-in `ID` scalar, which `gql.tada` types as
`string | number`. The [GraphQL specification](https://spec.graphql.org/draft/#sec-ID)
allows an `ID` to be serialized from either, but most APIs only return strings.
Custom scalars like `DateTime` or `JSON` default to `unknown`, since their type
isn't automatically known, and usually we'd want to map these too.

::: code-group
```ts twoslash [src/graphql.ts]
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql/graphql-env.d.ts';

export const graphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    ID: string; // [!code ++]
    DateTime: string; // [!code ++]
    JSON: unknown; // [!code ++]
    JSONObject: Record<string, unknown>; // [!code ++]
  };
}>();
// ---cut-after---

export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada';
export { readFragment } from 'gql.tada';
```
:::

Since these are only type-level modifications, they don't change any runtime values.
Make sure each matches what your GraphQL API actually returns.

### Opaque (branded) scalar types

Mapping a scalar to a primitive like `string` makes it indistinguishable from any
other string. For scalars that need (de)serialization you could consider using
an **opaque type** (also known as "branded types").

For example, `DateTime` is a common type in GraphQL that usually is serialized
as an ISO string. A branded type lets us annotate these strings with a unique symbol,
which TypeScript treats as distinct from plain `string`s. This allows us to enforce
serialization and deserialization.

::: code-group
```ts twoslash [src/graphql.ts]
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql/graphql-env.d.ts';

declare const tag: unique symbol;
export type DateTime = string & { readonly [tag]: 'DateTime' };

export const graphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    DateTime: DateTime; // [!code ++]
  };
}>();
// ---cut-after---

export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada';
export { readFragment } from 'gql.tada';
```
:::

The `DateTime` example type above makes this type distinct from just a `string`
which means we can create utilities to deserialize and serialize this scalar.

```ts twoslash
declare const tag: unique symbol;
type DateTime = string & { readonly [tag]: 'DateTime' };
// ---cut-before---
export const fromDateTime = (value: DateTime) => new Date(value);
export const toDateTime = (date: Date) => date.toISOString() as DateTime;
```

This keeps all marshalling logic in a single place and naturally enforces this
as a zero-cost typesystem abstraction, without any additional conversion overhead.

Without branding, a raw `string` may flow straight into `new Date(...)` or can
be missed at various code sites, scattering (and maybe diverging) its parsing
logic across a large codebase. With branding, we enforce that specific utility
functions are used with these scalars. The same can be useful for other unique
types that serialize to `string`s or `number`s, such as `URL`, `UUID`, or
`EmailAddress`.

> [!TIP]
> The cast inside `toDateTime()` is the one place the brand is asserted. Keeping
> that assertion isolated in a utility is the point. The rest of your code never
> casts.

---

## Working with Enums

By default, `gql.tada` infers GraphQL enums as a union of string literals, e.g.
`'Bug' | 'Dark' | 'Dragon'`. This is the right representation for new code: string
literal unions are forward-compatible and compile away to nothing.

`initGraphQLTada<>()` however allows remapping enum types to another TypeScript type.
This is most useful when migrating an existing codebase onto `gql.tada` — for example
from [GraphQL Code Generator](https://the-guild.dev/graphql/codegen), which by default
may emit a large amount of TypeScript `enum`s.

The `scalars` option can remap enum types by name, so you can slot your existing enum
back in and `gql.tada` will infer the exact type your code expects. This lets you
adopt it without rewriting every reference up front.

::: code-group
```ts twoslash [src/graphql.ts]
import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql/graphql-env.d.ts';

// The enum your existing code already imports:
export enum PokemonType {
  Fire = 'Fire',
  Water = 'Water',
  Grass = 'Grass',
}

export const graphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    PokemonType: PokemonType; // [!code ++]
  };
}>();
// ---cut-after---

export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada';
export { readFragment } from 'gql.tada';
```
:::

Wherever this enum's GraphQL type is selected, `gql.tada` now infers your
`PokemonType` enum instead of the default string literal union, so
existing call sites keep type checking unchanged.

> [!WARNING]
> Treat this as a migration aid, not a default. TypeScript `enum`s have
> [well-documented drawbacks](https://www.totaltypescript.com/why-i-dont-like-typescript-enums).
> They emit runtime code and are reference-incompatible with their own values, since
> each enum value is an independent symbol in the TypeScript type checker.
> Once a part of your codebase is migrated, drop the override and use the default
> string literal unions, which align with GraphQL's backwards-compatibility
> guarantees.

---

## TypeScript Performance

`gql.tada` infers everything in TypeScript's type system, so type-checking speed
scales with how much GraphQL you write. As a project grows, the editor or `tsc`
can slow down, and very large documents can hit
`Type instantiation is excessively deep and possibly infinite.ts(2589)`.

A few habits keep things fast:

- **Keep `gql.tada` up to date.** Inference performance and document-size limits
  improve across releases, and upgrading is the most common fix for `ts(2589)`.
- **Enable Turbo Mode.** [`gql-tada turbo`](/get-started/workflows#turbo-mode)
  pre-computes a cache of all document types. Checking it into your repository
  lets the plugin and CLI reuse the snapshot instead of re-inferring every type.
- **Use the `.d.ts` output format.**
  The [`tadaOutputLocation`](/reference/config-format#tadaoutputlocation) `.d.ts`
  format is much more efficient for the type-checker than `.ts`. Only use `.ts` if
  another tool needs the introspection data at runtime.
- **Compose with fragments.** Splitting a large query into
  [colocated fragments](/guides/fragment-colocation) keeps each selection set
  small, which is easier on inference.

<a href="/get-started/workflows" class="button">
  <h3>Essential Workflows</h3>
  <p>Learn more about Turbo Mode and the CLI commands</p>
</a>
