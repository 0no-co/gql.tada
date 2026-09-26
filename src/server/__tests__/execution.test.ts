import { describe, it, expect } from 'vitest';
import { graphql, subscribe, parse } from 'graphql';

import type { PostModel } from './fixtures/kitchenSink';
import { schema, createContext } from './fixtures/kitchenSink';

const run = async (
  source: string,
  variableValues?: Record<string, unknown>,
  contextValue = createContext()
) => graphql({ schema, source, variableValues, contextValue });

describe('execution', () => {
  it('resolves fields with default resolvers, resolvers, and nested lists', async () => {
    const result = await run(`
      {
        user(by: { id: "u2" }) {
          id
          name
          nickname
          role
          createdAt
          matrix
          meta
          posts { id }
        }
      }
    `);
    expect(result).toEqual({
      data: {
        user: {
          id: 'u2',
          name: 'Jovi',
          nickname: 'jd',
          role: 'MEMBER',
          createdAt: '2024-03-01T00:00:00.000Z',
          matrix: [[1, 2], null, [3]],
          meta: { id: 'u2' },
          posts: [],
        },
      },
    });
  });

  it('applies argument and input field defaults (field arguments)', async () => {
    const context = createContext();
    const result = await run(
      `{ user(by: { name: "Phil" }) { friends { name } } users { id } }`,
      undefined,
      context
    );
    expect(result.errors).toBeUndefined();
    expect(context.calls).toEqual([
      { name: 'User.friends', args: { first: 10, orderBy: { field: 'name', direction: 'ASC' } } },
      { name: 'RootQuery.users', args: { first: 20 } },
    ]);
  });

  it('coerces enum values to their internal values and recursive input objects', async () => {
    const context = createContext();
    const result = await run(
      `query ($filter: UserFilter) { users(filter: $filter, first: 5) { name role } }`,
      { filter: { or: [{ role: 'ADMIN' }, { role: 'GUEST' }] } },
      context
    );
    expect(result).toEqual({
      data: {
        users: [
          { name: 'Phil', role: 'ADMIN' },
          { name: 'Guest', role: 'GUEST' },
        ],
      },
    });
    expect(context.calls[0].args).toEqual({
      first: 5,
      filter: { or: [{ role: 'admin' }, { role: 'guest' }] },
    });
  });

  it('enforces OneOf Input Objects', async () => {
    const result = await run(`{ user(by: { id: "u1", name: "Phil" }) { id } }`);
    expect(result.errors![0].message).toMatch(/must specify exactly one key/);
  });

  it('parses and serializes custom scalars from literals and variables', async () => {
    const result = await run(`
      {
        now
        literal: echo(json: { a: [1, "b"] })
      }
    `);
    expect(result).toEqual({
      data: { now: '2025-09-03T00:00:00.000Z', literal: { a: [1, 'b'] } },
    });
    const variables = await run(`query ($json: JSON) { echo(json: $json) }`, { json: [true] });
    expect(variables).toEqual({ data: { echo: [true] } });
  });

  it('resolves abstract types via resolveType and isTypeOf', async () => {
    const result = await run(`
      {
        node(id: "p1") { __typename id ... on Post { title } }
        entities { __typename id }
        search(term: "Phil") { __typename ... on User { name } }
        more: search(term: "tada") { __typename ... on Post { title } }
      }
    `);
    expect(result).toEqual({
      data: {
        node: { __typename: 'Post', id: 'p1', title: 'Hello tada' },
        entities: [
          { __typename: 'User', id: 'u1' },
          { __typename: 'User', id: 'u2' },
          { __typename: 'User', id: 'u3' },
          { __typename: 'Post', id: 'p1' },
        ],
        search: [{ __typename: 'User', name: 'Phil' }],
        more: [{ __typename: 'Post', title: 'Hello tada' }],
      },
    });
  });

  it('executes mutations with input objects and defaulted input fields', async () => {
    const context = createContext();
    const result = await run(
      `mutation { createPost(input: { title: "New", authorId: "u2" }) { id title tags author { name } } }`,
      undefined,
      context
    );
    expect(result).toEqual({
      data: { createPost: { id: 'p2', title: 'New', tags: [], author: { name: 'Jovi' } } },
    });
    expect(context.posts).toHaveLength(2);
  });

  it('propagates non-null errors to the nearest nullable parent', async () => {
    const context = createContext();
    context.users[0].name = null as any;
    const result = await run(`{ user(by: { id: "u1" }) { name } }`, undefined, context);
    expect(result.data).toEqual({ user: null });
    expect(result.errors![0].message).toMatch(
      /Cannot return null for non-nullable field User.name/
    );
  });

  it('accepts executable directives', async () => {
    const result = await run(`query @trace(label: "q") { now @trace @trace(label: "twice") }`);
    expect(result.errors).toBeUndefined();
  });

  it('runs subscriptions from a source stream and maps each event', async () => {
    const post = (id: string, authorId: string): PostModel => ({
      kind: 'post',
      id,
      title: `Post ${id}`,
      tags: [],
      authorId,
      createdAt: new Date('2025-09-03T00:00:00.000Z'),
    });
    const events = (async function* () {
      yield post('p2', 'u1');
      yield post('p3', 'u2');
    })();

    const result = await subscribe({
      schema,
      document: parse(`subscription { postCreated(authorId: "u1") { id title } }`),
      contextValue: createContext(events),
    });

    const received: unknown[] = [];
    for await (const event of result as AsyncIterable<unknown>) received.push(event);
    expect(received).toEqual([
      { data: { postCreated: { id: 'p2', title: 'Post p2' } } },
      { data: { postCreated: { id: 'p3', title: '(filtered) Post p3' } } },
    ]);
  });
});
