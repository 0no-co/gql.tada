import { describe, it, expect } from 'vitest';
import { initGraphQLTada } from '../api';
import { readResult, maskFragments, unsafe_readResult } from '../testing';

const graphql = initGraphQLTada<{
  introspection: import('./fixtures/simpleIntrospection').simpleIntrospection;
}>();

describe('readResult', () => {
  it('re-exports the testing helpers', () => {
    expect(typeof readResult).toBe('function');
    expect(typeof maskFragments).toBe('function');
    expect(typeof unsafe_readResult).toBe('function');
  });

  it('returns the passed data unchanged', () => {
    const authorFragment = graphql(`
      fragment AuthorFields on Author {
        name
      }
    `);

    const todoFragment = graphql(
      `
        fragment TodoFields on Todo {
          id
          author {
            ...AuthorFields
          }
        }
      `,
      [authorFragment]
    );

    const query = graphql(
      `
        query Test {
          todos {
            id
            ...TodoFields
          }
        }
      `,
      [todoFragment]
    );

    const data = { todos: [{ id: 'id', author: { name: 'name' } }] };
    const result = readResult(query, data, [todoFragment, authorFragment]);

    expect(result).toBe(data);
  });
});
