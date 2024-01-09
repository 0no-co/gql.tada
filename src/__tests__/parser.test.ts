import { test } from 'vitest';
import * as ts from './tsHarness';

const testTypeHost = test.each([
  { strictNullChecks: false, noImplicitAny: false },
  { strictNullChecks: true },
]);

testTypeHost('parses kitchen sink query (%o)', options => {
  const virtualHost = ts.createVirtualHost({
    ...ts.readVirtualModule('expect-type'),
    ...ts.readVirtualModule('@0no-co/graphql.web'),
    'kitchensinkQuery.ts': ts.readFileFromRoot('src/__tests__/fixtures/kitchensinkQuery.ts'),
    'parser.ts': ts.readFileFromRoot('src/parser.ts'),
    'index.ts': `
      import { expectTypeOf } from 'expect-type';
      import { kitchensinkQuery, kitchensinkDocument } from './kitchensinkQuery';
      import { parseDocument } from './parser';

      type actual = parseDocument<typeof kitchensinkQuery>;

      expectTypeOf<actual>().toEqualTypeOf<kitchensinkDocument>();
    `,
  });

  ts.runDiagnostics(
    ts.createTypeHost({
      ...options,
      rootNames: ['index.ts'],
      host: virtualHost,
    })
  );
});
