import { describe, bench } from 'vitest';
import * as ts from './tsHarness';

const documents = `
  import { initGraphQLTada } from './api';
  import { simpleIntrospection } from './simpleIntrospection';

  const graphql = initGraphQLTada<{ introspection: simpleIntrospection; }>();

  export const authorFragment = graphql(\`
    fragment AuthorFields on Author {
      name
    }
  \`);

  export const todoFragment = graphql(\`
    fragment TodoFields on Todo {
      id
      author {
        ...AuthorFields
      }
    }
  \`, [authorFragment]);

  export const query = graphql(\`
    query {
      todos {
        id
        ...TodoFields
      }
    }
  \`, [todoFragment]);
`;

describe('readResult', () => {
  // Control: building the documents without `readResult`, so a regression here
  // would point at regular document creation rather than the unmasking machinery.
  const controlHost = ts.createVirtualHost({
    ...ts.readVirtualModule('@0no-co/graphql.web'),
    ...ts.readSourceFolders(['.']),
    'simpleIntrospection.ts': ts.readFileFromRoot('src/__tests__/fixtures/simpleIntrospection.ts'),
    'index.ts': `
      import { ResultOf } from './api';
      import { query } from './documents';
      const result: ResultOf<typeof query> = {} as any;
    `,
    'documents.ts': documents,
  });

  const controlTypeHost = ts.createTypeHost({
    rootNames: ['index.ts'],
    host: controlHost,
  });

  bench('create nested query (no readResult)', () => {
    ts.runDiagnostics(controlTypeHost);
  });

  const readResultHost = ts.createVirtualHost({
    ...ts.readVirtualModule('@0no-co/graphql.web'),
    ...ts.readSourceFolders(['.']),
    'simpleIntrospection.ts': ts.readFileFromRoot('src/__tests__/fixtures/simpleIntrospection.ts'),
    'index.ts': `
      import { readResult } from './testing';
      import { authorFragment, todoFragment, query } from './documents';

      const result = readResult(
        query,
        { todos: [{ id: 'id', author: { name: 'name' } }] },
        [todoFragment, authorFragment]
      );
    `,
    'documents.ts': documents,
  });

  const readResultTypeHost = ts.createTypeHost({
    rootNames: ['index.ts'],
    host: readResultHost,
  });

  bench('readResult with nested fragments', () => {
    ts.runDiagnostics(readResultTypeHost);
  });
});
