import * as path from 'node:path';
import ts from 'typescript';
import { describe, it, expect } from 'vitest';

import { hasGraphQLDocumentCandidate, shouldScanTurboFile } from '../scan';

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

function createSourceFile(sourceText: string): ts.SourceFile {
  return ts.createSourceFile('/fixture.ts', sourceText, ts.ScriptTarget.Latest, true);
}
