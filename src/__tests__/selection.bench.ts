import { describe, bench } from 'vitest';
import * as ts from './tsHarness';

describe('TypedDocument', () => {
  const virtualHost = ts.createVirtualHost({
    ...ts.readVirtualModule('@0no-co/graphql.web'),
    ...ts.readSourceFolders(['.']),
    'simpleSchema.ts': ts.readFileFromRoot('src/__tests__/fixtures/simpleSchema.ts'),
    'index.ts': `
      import type { simpleSchema as schema } from './simpleSchema';
      import type { Introspection } from './introspection';
      import type { Document } from './parser';
      import type { TypedDocument } from './selection';
      import type { Variables } from './variables';

      type document = Document<\`
        query ($org: String!, $repo: String!) {
          todos {
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
