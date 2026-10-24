import { t } from './builder.ts';
import { Query, Mutation } from './refs.ts';
import { DateTime, NodeType } from './common.ts';
import { UserType, UserQueries } from './users.ts';
import {
  TodoType,
  TodoStatus,
  TodoFilter,
  TodoBy,
  CreateTodoInput,
  UserTodos,
  SearchResult,
  TodoQueries,
  TodoMutations,
} from './todos.ts';

export const schema = t.schema({
  query: Query,
  mutation: Mutation,
  // Leaving out a type that's referenced is a type error
  types: [
    DateTime,
    NodeType,
    UserType,
    UserQueries,
    TodoType,
    TodoStatus,
    TodoFilter,
    TodoBy,
    CreateTodoInput,
    UserTodos,
    SearchResult,
    TodoQueries,
    TodoMutations,
  ],
});
