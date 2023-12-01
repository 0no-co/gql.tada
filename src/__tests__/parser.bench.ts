import { describe, bench } from 'vitest';
import * as ts from './tsHarness';

describe('Document', () => {
  (() => {
    const virtualHost = ts.createVirtualHost({
      ...ts.readVirtualModule('@0no-co/graphql.web'),
      'parser.ts': ts.readFileFromRoot('src/parser.ts'),
      'index.ts': `
        import type { Document } from './parser';
        type document = Document<'{ test }'>;
        type operation = document['definitions'][0]['operation'];
      `,
    });

    const typeHost = ts.createTypeHost({
      rootNames: ['index.ts'],
      host: virtualHost,
    });

    bench('parse simple document', () => {
      ts.runDiagnostics(typeHost);
    });
  })();

  (() => {
    const virtualHost = ts.createVirtualHost({
      ...ts.readVirtualModule('@0no-co/graphql.web'),
      'kitchensinkQuery.ts': ts.readFileFromRoot('src/__tests__/fixtures/kitchensinkQuery.ts'),
      'parser.ts': ts.readFileFromRoot('src/parser.ts'),
      'index.ts': `
        import type { Document } from './parser';
        import { kitchensinkQuery } from './kitchensinkQuery';
        type document = Document<typeof kitchensinkQuery>;
        type operation = document['definitions'][0]['operation'];
      `,
    });

    const typeHost = ts.createTypeHost({
      rootNames: ['index.ts'],
      host: virtualHost,
    });

    bench('parse kitchensink document', () => {
      ts.runDiagnostics(typeHost);
    });
  })();
});
