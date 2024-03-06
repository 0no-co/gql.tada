import { describe, bench } from 'vitest';
import * as ts from './tsHarness';

describe('Document', () => {
  (() => {
    const virtualHost = ts.createVirtualHost({
      ...ts.readVirtualModule('@0no-co/graphql.web'),
      'tokenizer.ts': ts.readFileFromRoot('src/tokenizer.ts'),
      'parser.ts': ts.readFileFromRoot('src/parser.ts'),
      'index.ts': `
        import { parseDocument } from './parser';
        type document = parseDocument<'{ test }'>;
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
      'tokenizer.ts': ts.readFileFromRoot('src/tokenizer.ts'),
      'parser.ts': ts.readFileFromRoot('src/parser.ts'),
      'index.ts': `
        import { parseDocument } from './parser';
        import { kitchensinkQuery } from './kitchensinkQuery';
        type document = parseDocument<typeof kitchensinkQuery>;
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
