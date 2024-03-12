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
> [to initialize `gql.tada` manually](../installation/#initializing-gqltada-manually),
> you’ll instead have to import your custom `graphql()` function, as
> returned by `initGraphQLTada()`.

## Queries

When passing a query to `graphql()`, it will be parsed in TypeScript’s type system
and the schema that’s set up is used to map this document over to a type.

```ts
import { graphql } from 'gql.tada';

const TodosQuery = graphql(`
  query Todos($limit: Int = 10) {
    todos(limit: $limit) {
      id
      title
      completed
    }
  }
`);
```

The `TodosQuery` variable will have an inferred type that defines the
type of the data result of the query. When adding variables, the types of variables
are added to the inferred type as well.
The resulting type is known as a [`TypedDocumentNode`](https://github.com/dotansimha/graphql-typed-document-node)
and is supported by most GraphQL clients.

When passing a `gql.tada` query to a GraphQL client, the type
of input variables and result data are inferred automatically.
For example, with `urql` and React, this may look like the following:

```tsx {"TodosQuery carries a type for data and variables:":4-10} {"Types for result and variables are applied from TodosQuery:":16-20}
import { useQuery } from 'urql';
import { graphql } from 'gql.tada';

const TodosQuery = graphql(`
  query Todos($limit: Int = 10) {
    todos(limit: $limit) {
      id
      title
      completed
    }
  }
`);

const TodosListComponent = () => {
  const [result] = useQuery({
    query: TodosQuery,
    variables: { limit: 5 },
  });

  return <ul />; // ...
};
```

The same applies to mutation operations, subscription operations, and fragment definitions.

The `graphql()` function will parse your GraphQL definitions, take the first definition it
finds and infers its type automatically.

```ts {"The first definition’s types are inferred:":3-11} {"Inferring the definition’s variables…":13-16} {"…and the definition’s result type.":18-24}
import { graphql, ResultOf, VariablesOf } from 'gql.tada';

const MarkCompletedMutation = graphql(`
  mutation MarkCompleted($id: ID!) {
    markCompleted(id: $id) {
      id
      completed
    }
  }
`);

const variables: VariablesOf<typeof MarkCompletedMutation> = {
  id: 'ExampleID',
};

const result: ResultOf<typeof MarkCompletedMutation> = {
  markCompleted: {
    id: 'ExampleID',
    completed: true,
  },
};
```

The above example uses the `ResultOf` and `VariablesOf` types for illustrative purposes.
These type utilities may be used to manually unwrap the types of a GraphQL `DocumentNode`
returned by `graphql()`.

## Fragments

The `graphql()` function allows for fragment composition, which means we’re able to create
a fragment and spread it into our definitions or other fragments.

Creating a fragment is the same as any other operation definition.
The type of the first definition, in this case a fragment, will be used
to infer the result type of the returned document:

```ts
import { graphql } from 'gql.tada';

const TodoItemFragment = graphql(`
  fragment TodoItem on Todo {
    id
    title
    completed
  }
`);
```

Spreading this fragment into another fragment or operation definition requires us
to pass the fragment into a tuple array on the `graphql()` function’s second argument.

```ts
const TodosQuery = graphql(
  `
    query Todos {
      todos {
        id
        ...TodoItem
      }
    }
  `,
  [TodoItemFragment]
);
```

Here we spread our `TodoItemFragment` into into `TodosQuery` by passing it into
the `graphql()` function and then using its name in the GraphQL document.

### Fragment Masking

However, in `gql.tada` a pattern called **“Fragment Masking”** applies.
`TodosQuery`’s result type does not contain the `title` and `comleted` field
from the spread fragment and instead contains a reference to the `TodoItemFragment`.

This forces us to unwrap, or rather “unmask”, the fragment first.

```tsx {"The data type here does not contain our TodoItemFragment fields:":24-25} {"Calling readFragment() unwraps the type of the fragment:":27-31}
import { useQuery } from 'urql';
import { graphql, readFragment } from 'gql.tada';

const TodoItemFragment = graphql(`
  fragment TodoItem on Todo {
    id
    title
    completed
  }
`);

const TodosQuery = graphql(
  `
    query Todos {
      todos {
        id
        ...TodoItem
      }
    }
  `,
  [TodoItemFragment]
);

const TodosListComponent = () => {
  const [result] = useQuery({ query: TodosQuery });

  const data = result.data!;

  return data.todos!.map((item) => {
    const todo = readFragment(TodoItemFragment, item);
    return null; // ...
  });
};
```

When spreading a fragment into a parent definition, the parent only contains a reference to the fragment.
This means that we’re isolating fragments. Any spread fragment data cannot be accessed directly until
the fragment is unmasked.

```ts {"TodoItem’s data is only accessible once unmasked with readFragment():":14-18}
import { ResultOf, readFragment } from 'gql.tada';

const result: ResultOf<typeof TodosQuery> = {
  todos: [
    {
      id: 'ExampleID',
      [$tada.fragmentRefs]: {
        TodoItem: $tada.ref;
      };
    },
  ]
};


const todos: ResultOf<typeof TodoItem>[] = readFragment(
  TodoItem,
  result.todos,
);
```

`TodoItem`’s fragment mask in `TodosQuery` is only unmasked and accessible as its plain result
type once we call `readFragment()` on the fragment mask.
In this case, we’re passing `result.todos`, which is a list of the objects containing the fragment
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

For example, our `TodoItemFragment` may be associated with a `TodoItem` component rendering
individual items:

```tsx title="components/TodoItem.tsx" {"The component accepts a fragment mask of TodoItemFragment:":12-13} {"In the component body we unwrap the fragment mask:":17-18}
import { graphql, readFragment } from 'gql.tada';

export const TodoItemFragment = graphql(`
  fragment TodoItem on Todo {
    id
    title
    completed
  }
`);

interface Props {
  data: FragmentOf<typeof TodoItemFragment>;
}

export const TodoItemComponent = ({ data }: Props) => {
  const todo = readFragment(TodoItemFragment, data);

  return <li />; // ...
};
```

The `FragmentOf` type is used as an input type above. This type accepts our fragment document
and creates the fragment mask that a fragment spread would create as well.

We can then use our new `TodoItemComponent` in our `TodosListComponent` and compose its `TodoItemFragment`
into our query:

```tsx title="components/TodoList.tsx" {"The masked fragment data is accepted as defined by FragmentOf:":19-20}
import { graphql } from 'gql.tada';
import { TodoItemFragment, TodoItemComponent } from './TodoItem';

const TodosQuery = graphql(
  `
    query Todos {
      todos {
        id
        ...TodoItem
      }
    }
  `,
  [TodoItemFragment]
);

export const TodoListComponent = ({ data }: Props) => {
  const [result] = useQuery({ query: TodosQuery });

  return (
    <ul>{result.data?.todos?.map((todo) => <TodoItemComponent data={todo} key={todo.id} />)}</ul>
  );
};
```

Meaning, while we can unmask and use the `TodoItemFragment`’s data in the `TodoItemComponent`,
the `TodoListComponent` cannot access any of the data requirements defined by and meant for the
`TodoItemComponent`.
