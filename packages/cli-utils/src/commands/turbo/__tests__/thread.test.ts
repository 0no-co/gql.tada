import * as path from 'node:path';
import ts from 'typescript';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../ts/transformers', () => ({
  transformExtensions: [] as const,
  transform: vi.fn(),
}));

import { hasGraphQLDocumentCandidate, shouldScanTurboFile } from '../scan';
import { collectImportsFromSourceFile } from '../thread';

describe('shouldScanTurboFile', () => {
  it('excludes generated cache, declarations, and node_modules files', () => {
    const root = path.resolve('/project');
    const turboOutputPath = path.join(root, 'src', 'graphql-cache.d.ts');
    const turboOutputPaths = new Set([turboOutputPath]);

    expect(shouldScanTurboFile(path.join(root, 'src', 'documents.ts'), turboOutputPaths)).toBe(
      true
    );
    expect(shouldScanTurboFile(turboOutputPath, turboOutputPaths)).toBe(false);
    expect(shouldScanTurboFile(path.join(root, 'src', 'graphql-env.d.ts'), turboOutputPaths)).toBe(
      false
    );
    expect(shouldScanTurboFile(path.join(root, 'types', 'env.d.mts'), turboOutputPaths)).toBe(
      false
    );
    expect(
      shouldScanTurboFile(
        path.join(root, 'node_modules', '@types', 'react', 'index.d.ts'),
        turboOutputPaths
      )
    ).toBe(false);
    expect(
      shouldScanTurboFile(path.join(root, 'node_modules', 'pkg', 'index.ts'), turboOutputPaths)
    ).toBe(false);
  });
});

describe('hasGraphQLDocumentCandidate', () => {
  it('accepts executable GraphQL documents in string-call arguments', () => {
    expect(
      hasGraphQLDocumentCandidate(
        createSourceFile(`
          graphql(\`query Pokemons { pokemons { id } }\`);
          graphql('fragment Pokemon on Pokemon { id }');
        `)
      )
    ).toBe(true);
  });

  it('accepts shorthand selection-set documents', () => {
    expect(
      hasGraphQLDocumentCandidate(
        createSourceFile(`
          graphql('{ viewer { id } }');
          graphql(\`
            # graphql
            { viewer { id } }
          \`);
        `)
      )
    ).toBe(true);
  });

  it('rejects files with only ordinary string-call arguments', () => {
    expect(
      hasGraphQLDocumentCandidate(
        createSourceFile(`
          t('settings.profile.title');
          describe('query retries', () => {});
          route('/users/:id', 'GET');
        `)
      )
    ).toBe(false);
  });
});

describe('collectImportsFromSourceFile', () => {
  it('excludes generated tada output imports for multi-schema projects', () => {
    const sourceFile = ts.createSourceFile(
      '/project/graphql/pokemon.ts',
      `
        import { initGraphQLTada } from 'gql.tada';
        import type { introspection } from './pokemon-env.d';
        import type { CountrySchema } from './countries-env.d';
        import type { UserScalar } from './types';
      `,
      ts.ScriptTarget.Latest,
      true
    );

    const imports = collectImportsFromSourceFile(
      sourceFile,
      {
        schemas: [
          {
            name: 'pokemon',
            schema: './graphql/pokemon.graphql',
            tadaOutputLocation: '/project/graphql/pokemon-env.d.ts',
          },
          {
            name: 'countries',
            schema: './graphql/countries.graphql',
            tadaOutputLocation: '/project/graphql/countries-env.d.ts',
          },
        ],
      },
      (specifier) => specifier,
      (specifier, fromPath) => {
        if (specifier === './pokemon-env.d') return '/project/graphql/pokemon-env.d.ts';
        if (specifier === './countries-env.d') return '/project/graphql/countries-env.d.ts';
        return path.resolve(path.dirname(fromPath), specifier);
      },
      '/project',
      '/project/graphql/pokemon-cache.d.ts'
    );

    expect(imports).toEqual([
      {
        specifier: './types',
        importClause: "import type { UserScalar } from './types';",
      },
    ]);
  });
});

function createSourceFile(sourceText: string): ts.SourceFile {
  return ts.createSourceFile('/fixture.ts', sourceText, ts.ScriptTarget.Latest, true);
}
