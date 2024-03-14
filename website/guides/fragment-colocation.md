---
title: Fragment Colocation
description: How GraphQL fragments are effectively used in componentized apps.
---

# Fragment Colocation

When presenting GraphQL, its features often turn into a
box-ticking exercise of comparing it to alternative solutions of
server-client API design, until we may ask ourselves whether
GraphQL’s strengths mostly lie in bringing a community together
with clever decisions we can now all agree and rely on…

However, while some of what makes GraphQL great is that many
of its core principles aren’t new ideas, its less talked about
strength lies in fragment composition and hierarchical schema design,
which matches our data needs for componentized apps.

## Introduction to Fragments

In GraphQL, fragments have many uses, and the uses of
“Fragment Colocation” are basically a combination of many
of the other uses for fragments.

### Reusing Selection Sets

At their most fundamental, fragments allow us to define a
selection set and reuse this set in multiple places of our
GraphQL document.

```ts
import { graphql } from 'gql.tada';

const query = graphql(`
  query PostsOverview {
    latestPosts {
      ...PostCard
    }
    trendingPosts {
      ...PostCard
    }
  }

  fragment PostCard on Post {
    id
    text
    createdAt
  }
`);
```

In the prior example, we’ve extracted two selection sets
into a `PostCard` fragment. When a query we’re writing
uses the same data in multiple code paths, we may use
fragments to only write a re-used selection set once.

### Type Conditions

Fragments are also used whenever we’re trying to specify
that a certain selection set only applies to one possible
type of an abstract type, like a `union` or `interface`.

```ts
import { graphql } from 'gql.tada';

const query = graphql(`
  query PostsOverview {
    latestPosts {
      id
      ...MediaCard
      ... on MediaPost {
        videoUrl
      }
      ...TextCard
      ... on TextPost {
        text
      }
    }
  }
`);
```

The above example shows a query for a schema where `latestPosts`
exposes an interface that is implemented by two types;
`MediaPost` and `TextPost`.

We may use fragments to conditionally apply a selection set
to either of these types, which is like “Type Narrowing” in
GraphQL.

> [!TIP]
> The above example uses an inline fragment spread, however, the
> same principle of type conditions applies to regular fragments
> and fragment spreads.

### `@include` & `@skip` Conditions

GraphQL also features two built-in directives, `@include` and
`@skip`, which we can use to conditionally include a fragment,
based on a variable we pass to our query.

```ts
import { graphql } from 'gql.tada';

const query = graphql(`
  query PostsOverview($showDetails: Boolean!) {
    latestPosts {
      id
      text
      ...PostDetails @include(if: $showDetails)
    }
  }

  fragment PostDetails on Post {
    id
    author {
      name
    }
    location {
      city
    }
  }
`);
```

Here, we only include a `PostDetails` fragment if `$showDetails`
is set, which means, fragments also allow us to alter the query
based on some input variables.
We can use this to slightly alter the result shape based on what
components we know we’ll render, while keeping the query itself
the same.

## Fragment Colocation

All the above examples of how we can use fragments may feel vaguely
familiar to us, even if this is the first time we’re seeing fragments
in action. That might be because fragments are structured very
similarly to how components in componentized apps work.

While querying fields is similar to how we _access_ data in front-end
code, and hence map the hierarchy of data we need; Fragments are similar
to how we may structure components.

::: code-group
```tsx twoslash [PokemonTypes.tsx]
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { FragmentOf, graphql } from 'gql.tada';

export const pokemonTypesFragment = graphql(`
  fragment PokemonTypes on Pokemon @_unmask {
    types
  }
`);

export const PokemonTypes = (props: {
  data: FragmentOf<typeof pokemonTypesFragment>
}) => {
  const { data } = props;
  return (
    <p>
      <h2>Types</h2>
      <ul>
        {data.types?.map((typing) => <li>{typing}</li>)}
      </ul>
    </p>
  );
};
```
:::

With fragments, like our `pokemonTypesFragment` above, we can define the data a
component _requires to render_ right next to the component itself, which
keeps concerns on how to fetch this data away from our presentational
components, while still defining what data the component requires.

### Nested Fragment Composition

While colocating fragments is interesting on its own, it really becomes
useful once we define more nested components, and compose their fragments.

Let’s create a `Pokemon` component that renders the `PokemonTypes`
component we’ve already defined above:

::: code-group
```tsx twoslash [Pokemon.tsx]
// @filename: PokemonTypes.tsx
import './graphql/graphql-env.d.ts';
import { FragmentOf, graphql } from 'gql.tada';

export const pokemonTypesFragment = graphql(`
  fragment PokemonTypes on Pokemon @_unmask {
    types
  }
`);

export const PokemonTypes = (props: {
  data: FragmentOf<typeof pokemonTypesFragment>
}) => null;
// @filename: Pokemon.tsx
// ---cut---
import { FragmentOf, graphql } from 'gql.tada';
import { pokemonTypesFragment, PokemonTypes } from './PokemonTypes';

export const pokemonFragment = graphql(`
  fragment Pokemon on Pokemon @_unmask {
    id
    name
    ...PokemonTypes
  }
`, [pokemonTypesFragment]);

export const Pokemon = (props: {
  data: FragmentOf<typeof pokemonFragment>
}) => {
  const { data } = props;
  return (
    <section>
      <p>{data.name}</p>
      <PokemonTypes data={data} />
    </section>
  );
};
```
:::

As we can see, defining reusing and composing fragments, is just as easy
as reusing and composing components.

No matter whether where we’re using the `Pokemon` or `PokemonTypes`
components, as long as we compose fragments upwards, we’ll eventually
be able to compose them into a query, at the level of our screen’s code,
and hence combine the data requirements of all of our components.

### Fragment Masking

In the previous examples, you may have noticed the `@_unmask` directive.

In `gql.tada`, a technique called “Fragment Masking” is applied to the
generated types of your fragments, and `@_unmask` disables this for the
purpose of our example code. Fragment Masking hides the types of a
fragment on the fragment’s derived type. This prevents leaking data
when composing fragments.

Let’s consider what happens if the `Pokemon` component started to accidentally
depend on data that only the `PokemonTypes`’s fragment defines.

::: code-group
```tsx twoslash [Pokemon.tsx]
// @filename: PokemonTypes.tsx
import './graphql/graphql-env.d.ts';
import { FragmentOf, graphql } from 'gql.tada';

export const pokemonTypesFragment = graphql(`
  fragment PokemonTypes on Pokemon @_unmask {
    types
  }
`);

export const PokemonTypes = (props: {
  data: FragmentOf<typeof pokemonTypesFragment>
}) => null;
// @filename: Pokemon.tsx
import { FragmentOf, graphql } from 'gql.tada';
import { pokemonTypesFragment, PokemonTypes } from './PokemonTypes';

export const pokemonFragment = graphql(`
  fragment Pokemon on Pokemon @_unmask {
    id
    name
    ...PokemonTypes
  }
`, [pokemonTypesFragment]);
// ---cut-before---
export const Pokemon = (props: {
  data: FragmentOf<typeof pokemonFragment>
}) => {
  const { data } = props;
  return (
    <section>
      <p>{data.name}</p>
// @error: Pokemon now accidentally depends on PokemonTypes’s data:

      <span>{data.types?.length}</span>
      <PokemonTypes data={data} />
    </section>
  );
};
```
:::

We can fix this by removing `@_unmask` on the `PokemonTypes` component’s fragment
to re-enable fragment masking. This will effectively “hide” the `pokemonTypesFragment`’s data
from the `Pokemon` component to keep the fragments isolated from one another
on a type-level.

::: code-group
```tsx twoslash [PokemonTypes.tsx]
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { FragmentOf, graphql, readFragment } from 'gql.tada';

// @annotate: Removing @_unmask isolates this fragment’s data.

export const pokemonTypesFragment = graphql(`
  fragment PokemonTypes on Pokemon {
    types
  }
`);

export const PokemonTypes = (props: {
  data: FragmentOf<typeof pokemonTypesFragment>
}) => {
// @annotate: We now have to add readFragment() to unwrap the masked fragment:

  const pokemon = readFragment(pokemonTypesFragment, props.data);
  return (
    <p>
      <h2>Types</h2>
      <ul>
        {pokemon.types?.map((typing) => <li>{typing}</li>)}
      </ul>
    </p>
  );
};
```
:::

> [!TIP]
> This is the default behaviour in `gql.tada`, and happens unless you add `@_unmask`
> to a fragment.
>
> However, by default, we recommend you not to disable Fragment Masking unless you
> absolutely have to, to enforce fragment composition.

Inside the inferred TypeScript types, when fragment masking _isn’t disabled_ using
`@_unmask`, then `gql.tada` will infer masked types. In TypeScript, the type that
`FragmentOf<>` returns may look like the following:

```ts
// FragmentType<typeof pokemonTypesFragment> with @_unmask:
type unmaskedPokemonTypes = {
  types: ("Bug" | "Dark" | /*...*/ null)[] | null;
};

// FragmentType<typeof pokemonTypesFragment> without @_unmask:
type maskedPokemonTypes = {
  [$tada.fragmentRefs]: {
    PokemonTypes: 'Pokemon';
  };
};
```
