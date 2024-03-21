import { describe, test } from 'vitest';

import * as ts from '../../../../../src/__tests__/tsHarness';
import simpleIntrospection from '../../../../../src/__tests__/fixtures/simpleIntrospection.json';
import { preprocessIntrospection } from '../preprocess';

const testTypeHost = test.each([
  { strictNullChecks: false, noImplicitAny: false },
  { strictNullChecks: true },
]);

describe('preprocessIntrospection', () => {
  testTypeHost('matches `mapIntrospection` output (%o)', (options) => {
    const introspectionType = preprocessIntrospection(simpleIntrospection as any);

    const virtualHost = ts.createVirtualHost({
      ...ts.readVirtualModule('expect-type'),
      'utils.ts': ts.readFileFromRoot('src/utils.ts'),
      'introspection.ts': ts.readFileFromRoot('src/introspection.ts'),
      'simpleSchema.ts': ts.readFileFromRoot('src/__tests__/fixtures/simpleSchema.ts'),
      'output.ts': `export type output = ${introspectionType};`,
      'index.ts': `
        import { expectTypeOf } from 'expect-type';
        import type { simpleSchema } from './simpleSchema';
        import type { output } from './output';

        expectTypeOf<output>().toMatchTypeOf<simpleSchema>();
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
});
