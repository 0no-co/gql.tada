---
title: Writing GraphQL
description: How to get set up and ready
---

# Writing GraphQL

In `gql.tada`, we write our GraphQL documents using the `graphql()`
function.

> [!NOTE]
> In the following examples, we’ll import `graphql()` from `gql.tada`.
> However, if you’ve previously followed the steps on the “Installation” page
> [to initialize `gql.tada` manually](./installation#initializing-gqltada-manually),
> you’ll instead have to import your custom `graphql()` function, as
> returned by `initGraphQLTada()`.

## Queries

When passing a query to `graphql()`, it will be parsed in TypeScript’s type system
and the schema that’s set up is used to map this document over to a type.

```ts twoslash
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { graphql } from 'gql.tada';

const PokemonsQuery = graphql(`
  query PokemonsList($limit: Int = 10) {
    pokemons(limit: $limit) {
      id
      name
    }
  }
`);
```

The `PokemonsQuery` variable will have an inferred type that defines the
type of the data result of the query. When adding variables, the types of variables
are added to the inferred type as well.
The resulting type is known as a [`TypedDocumentNode`](https://github.com/dotansimha/graphql-typed-document-node)
and is supported by most GraphQL clients.

When passing a `gql.tada` query to a GraphQL client, the type
of input variables and result data are inferred automatically.
For example, with `urql` and React, this may look like the following:

```tsx twoslash
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { useQuery } from 'urql';
import { graphql } from 'gql.tada';

// @annotate: PokemonsQuery carries a type for data and variables:

const PokemonsQuery = graphql(`
  query PokemonsList($limit: Int = 10) {
    pokemons(limit: $limit) {
      id
      name
    }
  }
`);

const PokemonsListComponent = () => {
// @annotate: Types for data and variables are applied from PokemonsQuery:

  const [result] = useQuery({
    query: PokemonsQuery,
    variables: { limit: 5 },
  });

  return (
    <ul>
      {result.data?.pokemons?.map((pokemon) => (
        <li key={pokemon?.id}>{pokemon?.name}</li>
      ))}
    </ul>
  );
};
```

The same applies to mutation operations, subscription operations, and fragment definitions.

The `graphql()` function will parse your GraphQL definitions, take the first definition it
finds and infers its type automatically.

```ts twoslash
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { graphql, ResultOf, VariablesOf } from 'gql.tada';

// @annotate: The first definition’s types are inferred:

const MarkCollectedMutation = graphql(`
  mutation MarkCollected($id: ID!) {
    markCollected(id: $id) {
      id
      name
      collected
    }
  }
`);

// @annotate: Inferring the definition’s variables…

type variables = VariablesOf<typeof MarkCollectedMutation>;

// @annotate: …and the definition’s result type.

type result = ResultOf<typeof MarkCollectedMutation>;
```

The above example uses the `ResultOf` and `VariablesOf` types for illustrative purposes.
These type utilities may be used to manually unwrap the types of a GraphQL `DocumentNode`
returned by `graphql()`.

<a href="/guides/typed-documents" class="button">
    Learn more about Typed Documents
</a>

---

## Fragments

The `graphql()` function allows for fragment composition, which means we’re able to create
a fragment and spread it into our definitions or other fragments.

Creating a fragment is the same as any other operation definition.
The type of the first definition, in this case a fragment, will be used
to infer the result type of the returned document:

```ts twoslash
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { graphql } from 'gql.tada';

const PokemonFragment = graphql(`
  fragment Pokemon on Pokemon {
    id
    name
    collected
  }
`);
```

Spreading this fragment into another fragment or operation definition requires us
to pass the fragment into a tuple array on the `graphql()` function’s second argument.

```ts twoslash
import './graphql/graphql-env.d.ts';
import { graphql } from 'gql.tada';

const PokemonFragment = graphql(`
  fragment Pokemon on Pokemon {
    id
    name
    collected
  }
`);

// ---cut-before---
const PokemonsList = graphql(`
  query PokemonsList {
    pokemons(limit: 10) {
      id
      ...Pokemon
    }
  }
`, [PokemonFragment]);
```

Here we spread our `PokemonFragment` into `PokemonsList` by passing it into
the `graphql()` function and then using its name in the GraphQL document.

### Fragment Masking

However, in `gql.tada` a pattern called **“Fragment Masking”** applies.
`PokemonsList`’s result type does not contain the `name` and `collected` field
from the spread fragment and instead contains a reference to the `PokemonFragment`.

This forces us to unwrap, or rather “unmask”, the fragment first.

```tsx twoslash
import './graphql/graphql-env.d.ts';
// ---cut-before---
import { useQuery } from 'urql';
import { graphql, readFragment } from 'gql.tada';

const PokemonFragment = graphql(`
  fragment Pokemon on Pokemon {
    id
    name
    collected
  }
`);

const PokemonsList = graphql(`
  query PokemonsList {
    pokemons(limit: 10) {
      id
      ...Pokemon
    }
  }
`, [PokemonFragment]);

const PokemonsListComponent = () => {
  const [result] = useQuery({ query: PokemonsList });

// @annotate: The data here does not contain our fragment’s fields:

const { pokemons } = result.data!;

  return pokemons?.map((item) => {
// @annotate: Calling readFragment() unwraps the type of the fragment:

    const pokemon = readFragment(PokemonFragment, item);
    return pokemon?.name;
  });
};
```

When spreading a fragment into a parent definition, the parent only contains a reference to the fragment.
This means that we’re isolating fragments. Any spread fragment data cannot be accessed directly until
the fragment is unmasked.

```ts twoslash
import './graphql/graphql-env.d.ts';
declare var client: import('@urql/core').Client;

// ---cut-before---
import { graphql, readFragment } from 'gql.tada';

const PokemonFragment = graphql(`
  fragment Pokemon on Pokemon {
    id
    name
    collected
  }
`);

const PokemonQuery = graphql(`
  query Pokemon($id: ID!) {
    pokemon(id: $id) {
      id
      ...Pokemon
    }
  }
`, [PokemonFragment]);

const result = await client.query(PokemonQuery, { id: '001' });
// @annotate: Pokemon’s data is only accessible once unmasked with readFragment()
const pokemon = readFragment(PokemonFragment, result.data?.pokemon);
```

`PokemonFragment`’s fragment mask in `PokemonQuery` is only unmasked and accessible as its plain result
type once we call `readFragment()` on the fragment mask.
In this case, we’re passing `data.pokemon`, which is an object containing the fragment
mask.

This all only happens and is enforced at a type level, meaning that we don’t incur any overhead
during runtime for masking our fragments.

### Fragment Composition

Fragment Masking is a concept that only exists to enforce proper **Fragment Composition**.

In a componentized app, fragments may be used to define the data requirements of UI components,
which means, we’ll define fragments, colocate them with our components, and compose them into
other fragments or our query.

Since all fragments are masked in our types, this colocation is enforced and we maintain our
data requirements to UI component relationship.

For example, our `PokemonFragment` may be associated with a `Pokemon` component rendering
individual items:

::: code-group
```tsx twoslash [components/Pokemon.tsx]
import './graphql/graphql-env.d.ts';
// ---cut-before---
// @filename: components/Pokemon.tsx
// ---cut---
import { graphql, readFragment, FragmentOf } from 'gql.tada';

export const PokemonFragment = graphql(`
  fragment Pokemon on Pokemon {
    id
    name
    collected
  }
`);

interface Props {
// @annotate: The component accepts a fragment mask of PokemonFragment:

  data: FragmentOf<typeof PokemonFragment>;
}

export const PokemonComponent = ({ data }: Props) => {
// @annotate: In the component body we unwrap the fragment mask:

  const pokemon = readFragment(PokemonFragment, data);
  return <li>{pokemon.name}</li>;
};
```
:::

The `FragmentOf` type is used as an input type above. This type accepts our fragment document
and creates the fragment mask that a fragment spread would create as well.

We can then use our new `PokemonComponent` in our `PokemonsListComponent` and compose its `PokemonFragment`
into our query:

::: code-group
```tsx twoslash [components/PokemonsList.tsx]
import './graphql/graphql-env.d.ts';
// ---cut-before---
// @filename: components/Pokemon.tsx
import { graphql, readFragment, FragmentOf } from 'gql.tada';

export const PokemonFragment = graphql(`
  fragment Pokemon on Pokemon {
    id
    name
    collected
  }
`);

interface Props {
// @annotate: The component accepts a fragment mask of PokemonFragment:

  data: FragmentOf<typeof PokemonFragment>;
}

export const PokemonComponent = ({ data }: Props) => {
// @annotate: In the component body we unwrap the fragment mask:

  const pokemon = readFragment(PokemonFragment, data);
  return <li>{pokemon.name}</li>;
};

// @filename: components/PokemonsList.tsx
// ---cut---
import { graphql } from 'gql.tada';
import { useQuery } from 'urql';
import { PokemonFragment, PokemonComponent } from './Pokemon';

const PokemonsListQuery = graphql(`
  query PokemonsList {
    pokemons(limit: 10) {
      id
      ...Pokemon
    }
  }
`, [PokemonFragment]);

export const PokemonsListComponent = () => {
  const [result] = useQuery({ query: PokemonsListQuery });

  return (
    <ul>
      {result.data?.pokemons?.map((pokemon) => (
// @annotate: The masked fragment data is accepted as defined by FragmentOf:

        <PokemonComponent data={pokemon!} key={pokemon?.id} />
      ))}
    </ul>
  );
};
```
:::

Meaning, while we can unmask and use the `PokemonFragment`’s data in the `PokemonComponent`,
the `PokemonsListComponent` cannot access any of the data requirements defined by and meant for the
`PokemonComponent`.

<a href="/guides/fragment-colocation" class="button">
    Learn more about Fragment Colocation
</a>
