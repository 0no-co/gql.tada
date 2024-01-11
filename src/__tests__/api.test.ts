import { describe, test } from 'vitest';
import * as ts from './tsHarness';

const testTypeHost = test.each([
  { strictNullChecks: false, noImplicitAny: false },
  { strictNullChecks: true },
]);

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
            introspection: typeof simpleIntrospection;
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

        expectTypeOf<typeof result>().toMatchTypeOf<{
          todos: ({
            id: string | number;
            complete: boolean | null;
          } | null)[] | null;
        }>();

        const todo = readFragment(todoFragment, result?.todos?.[0]);

        expectTypeOf<typeof todo>().toMatchTypeOf<{
          id: string | number;
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

        const graphql = initGraphQLTada<{ introspection: typeof simpleIntrospection; }>();

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

        expectTypeOf<typeof result>().toMatchTypeOf<{
          todos: ({
            id: string | number;
            complete: boolean | null;
          } | null)[] | null;
        }>();

        const todo = readFragment(todoFragment, result?.todos?.[0]);

        expectTypeOf<typeof todo>().toMatchTypeOf<{
          id: string | number;
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
