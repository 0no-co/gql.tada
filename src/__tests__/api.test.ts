import { Kind } from '@0no-co/graphql.web';
import { describe, it, test, expect } from 'vitest';
import * as ts from './tsHarness';
import type { simpleIntrospection } from './fixtures/simpleIntrospection';
import { initGraphQLTada } from '../api';

const testTypeHost = test.each([
  { strictNullChecks: false, noImplicitAny: false },
  { strictNullChecks: true },
]);

describe('graphql()', () => {
  it('should strip @_unmask from fragment documents', () => {
    const graphql = initGraphQLTada<{ introspection: simpleIntrospection }>();

    const todoFragment = graphql(`
      fragment TodoData on Todo @_unmask {
        id
        text
      }
    `);

    expect(todoFragment).toMatchObject({
      definitions: [
        {
          kind: Kind.FRAGMENT_DEFINITION,
          directives: [],
        },
      ],
    });
  });
});

describe('graphql.persisted()', () => {
  it('should return an empty document with a given ID', () => {
    const graphql = initGraphQLTada<{ introspection: simpleIntrospection }>();

    const query = graphql(`
      query Test {
        __typename
      }
    `);

    const persisted = graphql.persisted<typeof query>('Test');

    expect(persisted).toMatchObject({
      definitions: [],
      documentId: 'Test',
    });
  });
});

describe('declare setupSchema configuration', () => {
  testTypeHost('creates simple documents (%o)', (options) => {
    const virtualHost = ts.createVirtualHost({
      ...ts.readVirtualModule('expect-type'),
      ...ts.readVirtualModule('@0no-co/graphql.web'),
      ...ts.readSourceFolders(['.']),
      'simpleIntrospection.ts': ts.readFileFromRoot(
        'src/__tests__/fixtures/simpleIntrospection.ts'
      ),
      'index.ts': `
        import { expectTypeOf } from 'expect-type';
        import { simpleIntrospection } from './simpleIntrospection';
        import { ResultOf, FragmentOf, graphql, readFragment } from './api';
        import { $tada } from './namespace';

        declare module './api' {
          interface setupSchema {
            introspection: simpleIntrospection;
          }
        }

        const todoFragment = graphql(\`
          fragment TodoData on Todo {
            id
            text
          }
        \`);

        const todoQuery = graphql(\`
          query {
            todos {
              id
              complete
              ...TodoData
            }
          }
        \`, [todoFragment]);

        const result: ResultOf<typeof todoQuery> = {} as any;

        expectTypeOf<typeof result>().toEqualTypeOf<{
          todos: ({
            id: string;
            complete: boolean | null;
            [$tada.fragmentRefs]: {
              TodoData: 'Todo';
            };
          } | null)[] | null;
        }>();

        const todo = readFragment(todoFragment, result?.todos?.[0]);

        expectTypeOf<typeof todo>().toEqualTypeOf<{
          id: string;
          text: string;
        } | undefined | null>();
      `,
    });

    ts.runDiagnostics(
      ts.createTypeHost({
        ...options,
        rootNames: ['index.ts'],
        host: virtualHost,
      })
    );
  });
});

describe('initGraphQLTada configuration', () => {
  testTypeHost('creates simple documents (%o)', (options) => {
    const virtualHost = ts.createVirtualHost({
      ...ts.readVirtualModule('expect-type'),
      ...ts.readVirtualModule('@0no-co/graphql.web'),
      ...ts.readSourceFolders(['.']),
      'simpleIntrospection.ts': ts.readFileFromRoot(
        'src/__tests__/fixtures/simpleIntrospection.ts'
      ),
      'index.ts': `
        import { expectTypeOf } from 'expect-type';
        import { simpleIntrospection } from './simpleIntrospection';
        import { ResultOf, FragmentOf, initGraphQLTada, readFragment } from './api';
        import { $tada } from './namespace';

        const graphql = initGraphQLTada<{ introspection: simpleIntrospection; }>();

        const todoFragment = graphql(\`
          fragment TodoData on Todo {
            id
            text
          }
        \`);

        const todoQuery = graphql(\`
          query {
            todos {
              id
              complete
              ...TodoData
            }
          }
        \`, [todoFragment]);

        const result: ResultOf<typeof todoQuery> = {} as any;

        expectTypeOf<typeof result>().toEqualTypeOf<{
          todos: ({
            id: string;
            complete: boolean | null;
            [$tada.fragmentRefs]: {
              TodoData: 'Todo';
            };
          } | null)[] | null;
        }>();

        const todo = readFragment(todoFragment, result?.todos?.[0]);

        expectTypeOf<typeof todo>().toEqualTypeOf<{
          id: string;
          text: string;
        } | undefined | null>();
      `,
    });

    ts.runDiagnostics(
      ts.createTypeHost({
        ...options,
        rootNames: ['index.ts'],
        host: virtualHost,
      })
    );
  });

  testTypeHost('creates simple documents with unmasked fragments (%o)', (options) => {
    const virtualHost = ts.createVirtualHost({
      ...ts.readVirtualModule('expect-type'),
      ...ts.readVirtualModule('@0no-co/graphql.web'),
      ...ts.readSourceFolders(['.']),
      'simpleIntrospection.ts': ts.readFileFromRoot(
        'src/__tests__/fixtures/simpleIntrospection.ts'
      ),
      'index.ts': `
        import { expectTypeOf } from 'expect-type';
        import { simpleIntrospection } from './simpleIntrospection';
        import { ResultOf, FragmentOf, initGraphQLTada, readFragment } from './api';
        import { $tada } from './namespace';

        const graphql = initGraphQLTada<{ introspection: simpleIntrospection; }>();

        const todoFragment = graphql(\`
          fragment TodoData on Todo @_unmask {
            id
            text
          }
        \`);

        const todoQuery = graphql(\`
          query {
            todos {
              id
              complete
              ...TodoData
            }
          }
        \`, [todoFragment]);

        const result: ResultOf<typeof todoQuery> = {} as any;

        expectTypeOf<typeof result>().toEqualTypeOf<{
          todos: ({
            id: string;
            complete: boolean | null;
            text: string;
          } | null)[] | null;
        }>();

        const todo = readFragment(todoFragment, result?.todos?.[0]);

        expectTypeOf<typeof todo>().toEqualTypeOf<{
          id: string;
          text: string;
        } | undefined | null>();
      `,
    });

    ts.runDiagnostics(
      ts.createTypeHost({
        ...options,
        rootNames: ['index.ts'],
        host: virtualHost,
      })
    );
  });
});
