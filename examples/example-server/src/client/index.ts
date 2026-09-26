/* eslint-disable no-console */
import { Client, fetchExchange } from '@urql/core';
import { graphql, readFragment } from './graphql.ts';
import type { FragmentOf } from './graphql.ts';

const client = new Client({
  url: 'http://localhost:4000/graphql',
  exchanges: [fetchExchange],
});

const TodoFields = graphql(`
  fragment TodoFields on Todo {
    id
    text
    status
    createdAt
    author {
      name
    }
  }
`);

const TodosQuery = graphql(
  `
    query Todos($status: TodoStatus) {
      viewer {
        name
      }
      todos(filter: { status: $status }) {
        ...TodoFields
      }
    }
  `,
  [TodoFields]
);

const TodoQuery = graphql(
  `
    query Todo($by: TodoBy!) {
      todo(by: $by) {
        ...TodoFields
      }
    }
  `,
  [TodoFields]
);

const SearchQuery = graphql(`
  query Search($term: String!) {
    search(term: $term) {
      __typename
      ... on User {
        name
      }
      ... on Todo {
        text
      }
    }
  }
`);

const ToggleTodo = graphql(
  `
    mutation ToggleTodo($id: ID!) {
      toggleTodo(id: $id) {
        ...TodoFields
      }
    }
  `,
  [TodoFields]
);

const CreateTodo = graphql(
  `
    mutation CreateTodo($input: CreateTodoInput!) {
      createTodo(input: $input) {
        ...TodoFields
      }
    }
  `,
  [TodoFields]
);

function printTodo(data: FragmentOf<typeof TodoFields>) {
  const todo = readFragment(TodoFields, data);
  // `status` is typed as 'OPEN' | 'DONE', and `createdAt` as the serialized string
  const mark = todo.status === 'DONE' ? 'x' : ' ';
  console.log(`  [${mark}] ${todo.text} (by ${todo.author.name}, ${todo.createdAt})`);
}

// `input.status` is optional, since it has a default value
const created = await client.mutation(CreateTodo, {
  input: { text: 'Share the gql.tada example' },
});
if (created.error) throw created.error;

const open = await client.query(TodosQuery, { status: 'OPEN' });
if (open.error) throw open.error;
console.log(`Signed in as ${open.data!.viewer.name}. Open todos:`);
for (const todo of open.data!.todos) printTodo(todo);

const toggled = await client.mutation(ToggleTodo, {
  id: readFragment(TodoFields, created.data!.createTodo).id,
});
if (toggled.error) throw toggled.error;
console.log('Toggled the new todo:');
if (toggled.data!.toggleTodo) printTodo(toggled.data!.toggleTodo);

// OneOf Input Objects accept exactly one field
const byId = await client.query(TodoQuery, { by: { id: 't1' } });
if (byId.error) throw byId.error;
console.log('Todo t1:');
if (byId.data!.todo) printTodo(byId.data!.todo);

const search = await client.query(SearchQuery, { term: 'i' });
if (search.error) throw search.error;
console.log('Search results for "i":');
for (const result of search.data!.search) {
  // Union members are narrowed by `__typename`
  const label = result.__typename === 'User' ? result.name : result.text;
  console.log(`  ${result.__typename}: ${label}`);
}
