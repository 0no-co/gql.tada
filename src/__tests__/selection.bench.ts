import { describe, bench } from 'vitest';
import * as ts from './tsHarness';

describe('TypedDocument', () => {
  const virtualHost = ts.createVirtualHost({
    ...ts.readVirtualModule('@0no-co/graphql.web'),
    ...ts.readSourceFolders(['.']),
    'simpleSchema.ts': ts.readFileFromRoot('src/__tests__/fixtures/simpleSchema.ts'),
    'index.ts': `
      import { simpleSchema as schema } from './simpleSchema';
      import { parseDocument } from './parser';
      import { getDocumentType } from './selection';
      import { getVariablesType } from './variables';

      type document = parseDocument<\`
        query ($org: String!, $repo: String!) {
          todos {
            id
          }
        }
      \`>;

      type Result = getDocumentType<document, schema>;
      type Input = getVariablesType<document, schema>;
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
