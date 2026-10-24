import { describe, it, expect } from 'vitest';
import { graphql, subscribe, parse, GraphQLError } from 'graphql';

import { maskErrorsPlugin } from '../../../../examples/example-server/src/plugins/maskErrors';
import { initSchemaBuilder } from '../builder';

const createSchema = (logged: unknown[]) => {
  const t = initSchemaBuilder({
    plugins: [
      maskErrorsPlugin({
        message: 'Something went wrong.',
        onError: (error) => logged.push(error),
      }),
    ],
  });
  const Query = t.object(t.objectRef()('Query'), {
    fields: (f) => ({
      thrown: f.field({
        type: t.String,
        resolve: () => {
          throw new Error('thrown secret');
        },
      }),
      returned: f.field({ type: t.String, resolve: () => new Error('returned secret') as never }),
      rejected: f.field({
        type: t.String,
        resolve: () => Promise.reject(new Error('rejected secret')),
      }),
      expected: f.field({
        type: t.String,
        resolve: () => {
          throw new GraphQLError('Visible.', { extensions: { code: 'BAD_INPUT' } });
        },
      }),
      ok: f.field({ type: t.String, resolve: async () => 'ok' }),
    }),
  });
  const Subscription = t.object(t.objectRef()('Subscription'), {
    fields: (f) => ({
      events: f.field({
        type: t.String,
        subscribe: (): AsyncIterable<string> => {
          throw new Error('subscribe secret');
        },
        resolve: (value) => value,
      }),
    }),
  });
  return t.schema({ query: Query, subscription: Subscription });
};

describe('maskErrorsPlugin', () => {
  it('masks thrown, returned, and rejected errors, but not GraphQLErrors', async () => {
    const logged: unknown[] = [];
    const result = await graphql({
      schema: createSchema(logged),
      source: `{ thrown returned rejected expected ok }`,
    });
    expect(result.data).toEqual({
      thrown: null,
      returned: null,
      rejected: null,
      expected: null,
      ok: 'ok',
    });
    expect(result.errors!.map((error) => [error.message, error.extensions.code])).toEqual([
      ['Something went wrong.', 'INTERNAL_SERVER_ERROR'],
      ['Something went wrong.', 'INTERNAL_SERVER_ERROR'],
      ['Visible.', 'BAD_INPUT'],
      ['Something went wrong.', 'INTERNAL_SERVER_ERROR'],
    ]);
    expect(logged.map((error) => (error as Error).message)).toEqual([
      'thrown secret',
      'returned secret',
      'rejected secret',
    ]);
  });

  it('masks errors of subscribe functions', async () => {
    const logged: unknown[] = [];
    const result = await subscribe({
      schema: createSchema(logged),
      document: parse(`subscription { events }`),
    });
    expect((result as { errors: readonly GraphQLError[] }).errors.map((e) => e.message)).toEqual([
      'Something went wrong.',
    ]);
    expect(logged).toEqual([new Error('subscribe secret')]);
  });
});
