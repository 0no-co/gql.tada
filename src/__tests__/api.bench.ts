import { describe, bench } from 'vitest';
import * as ts from './tsHarness';

describe('Document', () => {
  const virtualHost = ts.createVirtualHost({
    ...ts.readVirtualModule('@0no-co/graphql.web'),
    ...ts.readSourceFolders(['.']),
    'simpleIntrospection.ts': ts.readFileFromRoot('src/__tests__/fixtures/simpleIntrospection.ts'),
    'index.ts': `
      import { simpleIntrospection } from './simpleIntrospection';
      import { ResultOf, initGraphQLTada, readFragment } from './api';

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
      const todo = readFragment(todoFragment, result?.todos?.[0]);
    `,
  });

  const typeHost = ts.createTypeHost({
    rootNames: ['index.ts'],
    host: virtualHost,
  });

  bench('create simple query', () => {
    ts.runDiagnostics(typeHost);
  });
});
