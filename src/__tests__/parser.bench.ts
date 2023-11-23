import { describe, bench } from 'vitest';
import * as ts from './tsHarness';

describe('Document', () => {
  const virtualHost = ts.createVirtualHost({
    ...ts.readVirtualModule('@0no-co/graphql.web'),
    'parser.ts': ts.readFileFromRoot('src/parser.ts'),
    'index.ts': `
      import type { Document } from './parser';
      type document  = Document<'{ test }'>;
      type operation = document['definitions'][0]['operation'];
    `,
  });

  const typeHost = ts.createTypeHost(['index.ts'], virtualHost);

  bench('parse document', () => {
    ts.createTypeChecker(typeHost).getDiagnostics();
  });
});
