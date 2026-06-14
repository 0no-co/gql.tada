import { describe, it, expectTypeOf } from 'vitest';

import type { simpleIntrospection } from './fixtures/simpleIntrospection';

import { initGraphQLTada } from '../api';
import type { ResultOf } from '../api';
import { readResult, maskFragments, unsafe_readResult } from '../testing';

const graphql = initGraphQLTada<{ introspection: simpleIntrospection }>();

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

describe('readResult', () => {
  it('re-exports the testing helpers from `gql.tada/testing`', () => {
    expectTypeOf(readResult).toBeFunction();
    expectTypeOf(maskFragments).toBeFunction();
    expectTypeOf(unsafe_readResult).toBeFunction();
  });

  it('reads a query with a single (direct) fragment', () => {
    const directFragment = graphql(`
      fragment Fields on Todo {
        fields: id
      }
    `);

    const directQuery = graphql(
      `
        query Test {
          todos {
            id
            ...Fields
          }
        }
      `,
      [directFragment]
    );

    const result = readResult(directQuery, { todos: [{ id: 'id', fields: 'id' }] }, [
      directFragment,
    ]);

    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<typeof directQuery>>();
  });

  it('reads nested fragments (a fragment that spreads another fragment)', () => {
    const result = readResult(query, { todos: [{ id: 'id', author: { name: 'name' } }] }, [
      todoFragment,
      authorFragment,
    ]);

    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<typeof query>>();
  });

  it('reads nullable nested fragment data', () => {
    const result = readResult(query, { todos: [{ id: 'id', author: null }, null] }, [
      todoFragment,
      authorFragment,
    ]);

    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<typeof query>>();
  });

  it('reads unmasked (@_unmask) nested fragments', () => {
    const unmaskedFragment = graphql(`
      fragment Fields on Todo @_unmask {
        text
      }
    `);

    const unmaskedQuery = graphql(
      `
        query Test {
          todos {
            id
            ...Fields
          }
        }
      `,
      [unmaskedFragment]
    );

    const result = readResult(unmaskedQuery, { todos: [{ id: 'id', text: 'text' }] }, [
      unmaskedFragment,
    ]);

    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<typeof unmaskedQuery>>();
  });

  it('errors when a nested fragment field has the wrong type', () => {
    readResult(
      query,
      {
        // @ts-expect-error - `author.name` must be a string
        todos: [{ id: 'id', author: { name: 42 } }],
      },
      [todoFragment, authorFragment]
    );
  });

  it('errors when a nested fragment field is missing', () => {
    readResult(
      query,
      {
        // @ts-expect-error - `author.name` is missing
        todos: [{ id: 'id', author: {} }],
      },
      [todoFragment, authorFragment]
    );
  });

  it('keeps a fragment masked when it is left out of the fragments list', () => {
    readResult(
      query,
      {
        // @ts-expect-error - `AuthorFields` is still masked, so inlined data is rejected
        todos: [{ id: 'id', author: { name: 'name' } }],
      },
      [todoFragment]
    );
  });

  it('treats an empty fragments list as everything staying masked', () => {
    readResult(
      query,
      {
        // @ts-expect-error - `TodoFields` is still masked, so inlined data is rejected
        todos: [{ id: 'id' }],
      },
      []
    );
  });

  it('accepts masked data for a fragment left out of the fragments list', () => {
    const result = readResult(
      query,
      {
        todos: [{ id: 'id', author: maskFragments([authorFragment], { name: 'name' }) }],
      },
      [todoFragment]
    );

    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<typeof query>>();
  });
});
