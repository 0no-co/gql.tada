import { describe, bench } from 'vitest';
import * as ts from './tsHarness';

describe('Introspection', () => {
  (() => {
    const virtualHost = ts.createVirtualHost({
      ...ts.readVirtualModule('@0no-co/graphql.web'),
      ...ts.readSourceFolders(['.']),
      'simpleIntrospection.ts': ts.readFileFromRoot(
        'src/__tests__/fixtures/simpleIntrospection.ts'
      ),
      'index.ts': `
        import { simpleIntrospection } from './simpleIntrospection';
        import { mapIntrospection } from './introspection';

        type schema = mapIntrospection<simpleIntrospection>;
      `,
    });

    const typeHost = ts.createTypeHost({
      rootNames: ['index.ts'],
      host: virtualHost,
    });

    bench('converts simple introspection', () => {
      ts.runDiagnostics(typeHost);
    });
  })();

  (() => {
    const virtualHost = ts.createVirtualHost({
      ...ts.readVirtualModule('@0no-co/graphql.web'),
      ...ts.readSourceFolders(['.']),
      'githubIntrospection.ts': ts.readFileFromRoot(
        'src/__tests__/fixtures/githubIntrospection.ts'
      ),
      'index.ts': `
        import { githubIntrospection } from './githubIntrospection';
        import type { mapIntrospection } from './introspection';

        type schema = mapIntrospection<githubIntrospection>;
      `,
    });

    const typeHost = ts.createTypeHost({
      rootNames: ['index.ts'],
      host: virtualHost,
    });

    bench('converts github introspection', () => {
      ts.runDiagnostics(typeHost);
    });
  })();
});
