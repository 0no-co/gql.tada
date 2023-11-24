import { describe, bench } from 'vitest';
import * as ts from './tsHarness';

describe('TypedDocument', () => {
  const virtualHost = ts.createVirtualHost({
    ...ts.readVirtualModule('@0no-co/graphql.web'),

    'githubIntrospection.ts': ts.readFileFromRoot('src/__tests__/fixtures/githubIntrospection.ts'),
    'introspection.ts': ts.readFileFromRoot('src/introspection.ts'),
    'parser.ts': ts.readFileFromRoot('src/parser.ts'),
    'utils.ts': ts.readFileFromRoot('src/utils.ts'),
    'typed-document/index.ts': ts.readFileFromRoot('src/typed-document/index.ts'),
    'typed-document/variables.ts': ts.readFileFromRoot('src/typed-document/variables.ts'),
    'typed-document/fragments.ts': ts.readFileFromRoot('src/typed-document/fragments.ts'),

    'index.ts': `
      import type { GitHubIntrospection } from './githubIntrospection';
      import type { Document } from './parser';
      import type { TypedDocument } from './typed-document';
      import type { Variables } from './typed-document/variables';

      type document = Document<\`
        query ($org: String!, $repo: String!) {
          repository(owner: $org, name: $repo) {
            id
          }
        }
      \`>;

      type Result = TypedDocument<document, GitHubIntrospection>;
      type Input = Variables<document, GitHubIntrospection>;
      const x: Result['repository'] = null;
    `,
  });

  const typeHost = ts.createTypeHost(['index.ts'], virtualHost);

  bench('derives typed document', () => {
    ts.runDiagnostics(typeHost);
  });
});
