---
title: Testing
description: How to write type-safe test fixtures and fake data with fragment masking.
---

# Testing

<section>
  Fragment masking keeps each component honest about the data it
  uses, but it can make test fixtures and fake data tricky to write.
  <code>gql.tada/testing</code> has a set of testing helpers to make
  test data type-safe.
</section>

With [fragment masking](/guides/fragment-colocation#fragment-masking), fragments
are opaque and isolated at the type-level, which enforces that a parent never
sees the data its children selected. This helps in app code, but complicates tests.
Mock data written by hand has the shape of the _unmasked_ fragment result, which
won't match the masked types the document expects.

The `gql.tada/testing` entrypoint exports three helpers to bridge this gap. They
are meant for tests, stories, fixtures, and cache updaters.

::: tip
Reach for these only at the boundary where you construct mock data.
Inside the component or function under test, keep using
[`readFragment()`](/reference/gql-tada-api#readfragment)
as you normally would.
:::

---

## Masking a fragment's data

[`maskFragments()`](/reference/gql-tada-api#maskfragments) takes a list of
fragments and the (unmasked) data for them, and returns that data typed as a
masked fragment reference. This is the helper you want when a component under test
accepts a `FragmentOf<typeof fragment>` prop and you need to hand it a fixture:

```ts twoslash [pokemon.test.ts]
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { graphql } from 'gql.tada';
import { maskFragments } from 'gql.tada/testing';

const pokemonItemFragment = graphql(`
  fragment PokemonItem on Pokemon {
    id
    name
  }
`);

// Ready to pass as a prop:
const data = maskFragments([pokemonItemFragment], {
  id: '001',
  name: 'Bulbasaur',
});
```

`maskFragments()` also accepts `null`, `undefined`, and arrays of data, so you can
build fixtures for nullable or list-typed fragment props directly.

---

## Building a document's result

[`readResult()`](/reference/gql-tada-api#readresult) builds a type-safe
fixture for a whole document. You pass it the document, the data with fragment
fields inlined, and the list of fragments the document uses. It resolves the
references so your data is fully type checked, including fragments that
themselves spread other fragments.

```ts twoslash [pokemon.test.ts]
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { graphql } from 'gql.tada';
import { readResult } from 'gql.tada/testing';

const pokemonNameFragment = graphql(`
  fragment PokemonName on Pokemon {
    name
  }
`);

const pokemonItemFragment = graphql(`
  fragment PokemonItem on Pokemon {
    id
    ...PokemonName
  }
`, [pokemonNameFragment]);

const query = graphql(`
  query {
    pokemon(id: "001") {
      ...PokemonItem
    }
  }
`, [pokemonItemFragment]);

// Fully type-checked, including nested fragments:
const data = readResult(
  query,
  { pokemon: { id: '001', name: 'Bulbasaur' } },
  [pokemonItemFragment, pokemonNameFragment]
);
```

Pass **every** fragment you want inlined, including ones spread transitively by
other fragments. Any fragment you leave out of the list stays masked: instead of
inlined fields, it shows up as a still-masked reference in the expected data.

This is handy when you'd rather build part of the result with
[`maskFragments()`](#masking-a-fragment-s-data). Leave that fragment out, and
slot the masked value in instead, if you already have mocked data for an individual
fragment.

### Casting results unsafely

[`unsafe_readResult()`](/reference/gql-tada-api#unsafe_readresult) casts data to a
document's result type **without type checking** the data nested inside fragment
references. It's a slightly safer alternative to `as any as ResultOf<typeof query>`.

```ts twoslash [pokemon.test.ts]
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { graphql } from 'gql.tada';
import { unsafe_readResult } from 'gql.tada/testing';

const pokemonItemFragment = graphql(`
  fragment PokemonItem on Pokemon {
    id
    name
  }
`);

const query = graphql(
  `
    query {
      pokemon(id: "001") {
        ...PokemonItem
      }
    }
  `,
  [pokemonItemFragment]
);

// ⚠️ data is cast to the result type WITHOUT checking the fragment fields:
const data = unsafe_readResult(query, {
  pokemon: { id: '001', name: 'Bulbasaur' },
});
```

> [!CAUTION]
> Because `unsafe_readResult()` doesn't check the data inside fragment masks, a
> typo or missing field won't be caught. Prefer
> [`readResult()`](#building-a-document-s-result) whenever you can, and reach for
> this only when listing every fragment is impractical.

<a href="/reference/gql-tada-api#testing-functions" class="button">
  <h3>Testing Functions</h3>
  <p>See the full API reference for these helpers</p>
</a>
