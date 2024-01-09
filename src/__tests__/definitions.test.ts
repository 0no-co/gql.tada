import { describe, test } from 'vitest';
import * as ts from './tsHarness';

const testTypeHost = test.each([
  { strictNullChecks: false, noImplicitAny: false },
  { strictNullChecks: true },
]);

describe('simple introspection', () => {
  testTypeHost('infers simple document (%o)', options => {
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
        import type { Introspection } from './introspection';
        import type { Document } from './parser';
        import type { TypedDocument } from './definitions';
        import type { Variables } from './variables';

        type query = Document<\`
          {
            todos {
              id
              ... on Todo { text }
              ... on Todo { complete }
            }
          }
        \`>;

        type schema = Introspection<typeof simpleIntrospection>;
        type actual = TypedDocument<query, schema>;

        expectTypeOf<{
          todos: Array<{
            id: string | number;
            text: string;
            complete: boolean | null;
          } | null> | null;
        }>().toEqualTypeOf<actual>();
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

  testTypeHost('infers union and interface documents (%o)', options => {
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
        import type { Introspection } from './introspection';
        import type { Document } from './parser';
        import type { TypedDocument } from './definitions';
        import type { Variables } from './variables';

        type query = Document<\`
          query {
            test {
              __typename
              ...InterfaceFields
              ... on SmallTodo { text maxLength __typename }
              ... on BigTodo { wallOfText __typename }
            }
          }

          fragment InterfaceFields on ITodo {
            id
            __typename
          }
        \`>;

        type schema = Introspection<typeof simpleIntrospection>;
        type actual = TypedDocument<query, schema>;

        expectTypeOf<{
          test: null | {
            __typename: 'SmallTodo';
            id: string | number;
            text: string;
            maxLength: number | null;
          } | {
            __typename: 'BigTodo';
            id: string | number;
            wallOfText: string | null;
          };
        }>().toEqualTypeOf<actual>();
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
