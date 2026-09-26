import type { TodoModel } from '../db.ts';
import { t } from './builder.ts';
import { Query, Mutation, Node, User, Todo } from './refs.ts';
import { DateTime, usersById } from './common.ts';

// Enum values map to the internal values that resolvers use
export const TodoStatus = t.enum('TodoStatus', {
  values: {
    OPEN: { value: 'open', description: 'Still to do' },
    DONE: { value: 'done' },
  },
});

export const TodoFilter = t.input('TodoFilter', {
  fields: {
    status: TodoStatus,
    first: { type: t.nonNull(t.Int), defaultValue: 10 },
  },
});

// Exactly one field must be passed to a OneOf Input Object
export const TodoBy = t.input('TodoBy', {
  isOneOf: true,
  fields: { id: t.ID, text: t.String },
});

export const CreateTodoInput = t.input('CreateTodoInput', {
  fields: {
    text: t.nonNull(t.String),
    status: { type: t.nonNull(TodoStatus), defaultValue: 'open' },
  },
});

export const TodoType = t.object(Todo, {
  interfaces: [Node],
  fields: (f) => ({
    id: f.field({ type: t.nonNull(t.ID) }),
    text: f.field({ type: t.nonNull(t.String) }),
    status: f.field({ type: t.nonNull(TodoStatus) }),
    done: f.field({
      type: t.nonNull(t.Boolean),
      deprecationReason: 'Use `status`',
      resolve: (todo) => todo.status === 'done',
    }),
    createdAt: f.field({ type: t.nonNull(DateTime) }),
    author: f.field({
      type: t.nonNull(User),
      resolve: (todo, _args, ctx) => usersById(ctx).get(todo.authorId)!,
    }),
  }),
});

// Extends the `User` type, which is defined in another module
export const UserTodos = t.object(User, {
  fields: (f) => ({
    todos: f.field({
      type: t.nonNull(t.list(t.nonNull(Todo))),
      resolve: (user, _args, ctx) => ctx.db.todos.filter((todo) => todo.authorId === user.id),
    }),
  }),
});

export const SearchResult = t.union('SearchResult', {
  types: [User, Todo],
  resolveType: (value) => ('text' in value ? 'Todo' : 'User'),
});

export const TodoQueries = t.object(Query, {
  fields: (f) => ({
    todos: f.field({
      type: t.nonNull(t.list(t.nonNull(Todo))),
      args: { filter: TodoFilter },
      resolve: (_, { filter }, ctx) =>
        ctx.db.todos
          .filter((todo) => !filter || filter.status == null || todo.status === filter.status)
          .slice(0, filter ? filter.first : undefined),
    }),
    todo: f.field({
      type: Todo,
      args: { by: t.nonNull(TodoBy) },
      resolve: (_, { by }, ctx) =>
        ctx.db.todos.find((todo) => ('id' in by ? todo.id === by.id : todo.text === by.text)),
    }),
    node: f.field({
      type: Node,
      args: { id: t.nonNull(t.ID) },
      resolve: (_, { id }, ctx) =>
        usersById(ctx).get(id) || ctx.db.todos.find((todo) => todo.id === id),
    }),
    search: f.field({
      type: t.nonNull(t.list(t.nonNull(SearchResult))),
      args: { term: t.nonNull(t.String) },
      resolve: (_, { term }, ctx) => [
        ...ctx.db.users.filter((user) => user.name.includes(term)),
        ...ctx.db.todos.filter((todo) => todo.text.includes(term)),
      ],
    }),
  }),
});

export const TodoMutations = t.object(Mutation, {
  fields: (f) => ({
    createTodo: f.field({
      type: t.nonNull(Todo),
      args: { input: t.nonNull(CreateTodoInput) },
      resolve(_, { input }, ctx) {
        const todo: TodoModel = {
          id: `t${ctx.db.todos.length + 1}`,
          text: input.text,
          status: input.status,
          authorId: ctx.viewerId,
          createdAt: new Date(),
        };
        ctx.db.todos.push(todo);
        return todo;
      },
    }),
    toggleTodo: f.field({
      type: Todo,
      args: { id: t.nonNull(t.ID) },
      resolve(_, { id }, ctx) {
        const todo = ctx.db.todos.find((todo) => todo.id === id);
        if (todo) todo.status = todo.status === 'open' ? 'done' : 'open';
        return todo;
      },
    }),
  }),
});
