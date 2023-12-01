import { describe, bench } from 'vitest';
import * as ts from './tsHarness';

describe('TypedDocument', () => {
  const virtualHost = ts.createVirtualHost({
    ...ts.readVirtualModule('@0no-co/graphql.web'),
    ...ts.readSourceFolders(['.', 'typed-document']),
    'githubIntrospection.ts': ts.readFileFromRoot('src/__tests__/fixtures/githubIntrospection.ts'),
    'index.ts': `
      import { githubIntrospection } from './githubIntrospection';
      import type { Introspection } from './introspection';
      import type { Document } from './parser';
      import type { TypedDocument } from './typed-document';
      import type { Variables } from './typed-document/variables';

      type schema = Introspection<typeof githubIntrospection>;

      type document = Document<\`
        query ($org: String!, $repo: String!) {
          repository(owner: $org, name: $repo) {
            id
          }
        }
      \`>;

      type Result = TypedDocument<document, schema>;
      type Input = Variables<document, schema>;
    `,
  });

  const typeHost = ts.createTypeHost({
    rootNames: ['index.ts'],
    host: virtualHost,
  });

  bench('derives typed document', () => {
    ts.runDiagnostics(typeHost);
  });
});
