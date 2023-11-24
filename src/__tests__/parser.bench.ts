import { describe, bench } from 'vitest';
import * as ts from './tsHarness';

describe('Document', () => {
  const virtualHost = ts.createVirtualHost({
    ...ts.readVirtualModule('@0no-co/graphql.web'),
    'introspection.ts': ts.readFileFromRoot('src/kitchen-sink/index.ts'),
    'parser.ts': ts.readFileFromRoot('src/parser.ts'),
    'typed-document.ts': ts.readFileFromRoot('src/typed-document/index.ts'),
    'variables.ts': ts.readFileFromRoot('src/typed-document/variables.ts'),
    'index.ts': `
      import type { GitHubIntrospection } from './introspection';
      import type { Document } from './parser';
      import type { TypedDocument } from './typed-document';
      import type { Variables } from './variables';

      type document  = Document<'
        query ($org: String!, $repo: String!) {
          repository(owner: $org, name: $repo) {
            id
          }
        }
      '>;

      type Result = TypedDocument<document, GitHubIntrospection>
      type Input = Variables<document, GitHubIntrospection>
    `,
  });

  const typeHost = ts.createTypeHost(['index.ts'], virtualHost);

  bench('parse document', () => {
    ts.createTypeChecker(typeHost).getDiagnostics();
  });
});
