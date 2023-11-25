import { test, assertType } from 'vitest';
import { simpleIntrospection } from './fixtures/simpleIntrospection';
import { IntrospectionTypes, Introspection } from '../introspection';

const any = {} as any;

test('prepares sample schema', () => {
  type actualTypes = {
    Query: {
      kind: 'OBJECT';
      fields: {
        todos: { name: 'todos' };
        latestTodo: { name: 'latestTodo' };
        test: { name: 'test' };
      };
    };
    LatestTodoResult: {
      kind: 'UNION';
      possibleTypes: 'Todo' | 'NoTodosError';
    };
    NoTodosError: {
      kind: 'OBJECT';
      fields: {
        message: { name: 'message' };
      };
    };
    Todo: {
      kind: 'OBJECT';
      fields: {
        id: { name: 'id' };
        text: { name: 'text' };
        complete: { name: 'complete' };
        test: { name: 'test' };
        author: { name: 'author' };
      };
    };
    ID: {
      kind: 'SCALAR';
      type: string | number;
    };
    String: {
      kind: 'SCALAR';
      type: string;
    };
    Boolean: {
      kind: 'SCALAR';
      type: boolean;
    };
    Author: {
      kind: 'OBJECT';
      fields: {
        id: { name: 'id' };
        name: { name: 'name' };
        known: { name: 'known' };
      };
    };
    Mutation: {
      kind: 'OBJECT';
      fields: {
        toggleTodo: { name: 'toggleTodo' };
      };
    };
    Subscription: {
      kind: 'OBJECT';
      fields: {
        newTodo: { name: 'newTodo' };
      };
    };
  };

  type actual = {
    query: 'Query';
    mutation: 'Mutation';
    subscription: 'Subscription';
    types: {};
  };

  const expectedTypes = any as IntrospectionTypes<typeof simpleIntrospection>;
  assertType<actualTypes>(expectedTypes);

  const expected = any as Introspection<typeof simpleIntrospection>;
  assertType<actual>(expected);
});
