import { describe, test, it, expect } from 'vitest';
import { format } from 'prettier';

import * as ts from '../../../../../src/__tests__/tsHarness';
import simpleIntrospection from '../../../../../src/__tests__/fixtures/simpleIntrospection.json';
import { minifyIntrospectionQuery } from '../minify';
import { preprocessIntrospection } from '../preprocess';

const testTypeHost = test.each([
  { strictNullChecks: false, noImplicitAny: false },
  { strictNullChecks: true },
]);

const introspectionType = preprocessIntrospection(
  minifyIntrospectionQuery(simpleIntrospection as any)
);

describe('preprocessIntrospection', () => {
  testTypeHost('matches `mapIntrospection` output (%o)', (options) => {
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

  it('matches simpleSchema.ts', async () => {
    const OPTS = {
      filepath: 'simpleSchema.ts',
      singleQuote: true,
      tabWidth: 2,
      printWidth: 0,
      trailingComma: 'es5',
    } as const;

    const [expectedSchema, actualSchema] = await Promise.all([
      format(ts.readFileFromRoot('src/__tests__/fixtures/simpleSchema.ts').toString(), OPTS),
      format(`export type simpleSchema = ${introspectionType};`, OPTS),
    ]);

    expect(actualSchema).toEqual(expectedSchema);
  });
});
