import { describe, it, expect } from 'vitest';

import type { TurboDocument, GraphQLSourceFile } from '../types';
import { createCacheContents } from '../runner';

const makeDocument = (argumentKey: string, extra?: Partial<TurboDocument>): TurboDocument => ({
  schemaName: null,
  argumentKey,
  documentType: 'TadaDocumentNode<{ id: string; }, {}, void>',
  ...extra,
});

describe('createCacheContents', () => {
  it('emits documents sorted by argument key, independent of input order', () => {
    const documents = [
      makeDocument('"query Zebra { id }"', { documentHash: 'sha256:zebra' }),
      makeDocument('"fragment Apple on Fruit { id }"', { documentHash: 'sha256:apple' }),
      makeDocument('"query Mango { id }"'),
    ];

    const contents = createCacheContents(documents, [], '/project/src/graphql-cache.d.ts');
    const reversed = createCacheContents(
      [...documents].reverse(),
      [],
      '/project/src/graphql-cache.d.ts'
    );

    expect(reversed).toBe(contents);
    expect(contents.indexOf('"fragment Apple on Fruit { id }"')).toBeLessThan(
      contents.indexOf('"query Mango { id }"')
    );
    expect(contents.indexOf('"query Mango { id }"')).toBeLessThan(
      contents.indexOf('"query Zebra { id }"')
    );
    expect(contents).toContain(
      '    /** @gql.tada/hash sha256:apple */\n' +
        '    "fragment Apple on Fruit { id }":\n' +
        '      TadaDocumentNode<{ id: string; }, {}, void>;'
    );
  });

  it('keeps the last duplicate of an argument key', () => {
    const contents = createCacheContents(
      [
        makeDocument('"query Pokemon { id }"', { documentType: 'TadaDocumentNode<1, 1>' }),
        makeDocument('"query Pokemon { id }"', { documentType: 'TadaDocumentNode<2, 2>' }),
      ],
      [],
      '/project/src/graphql-cache.d.ts'
    );

    expect(contents).toContain('TadaDocumentNode<2, 2>');
    expect(contents).not.toContain('TadaDocumentNode<1, 1>');
  });

  it('emits imports sorted by source path, independent of discovery order', () => {
    const sources: GraphQLSourceFile[] = [
      {
        absolutePath: '/project/src/b/documents.ts',
        imports: [{ specifier: './b-types', importClause: "import type { B } from './b-types';" }],
      },
      {
        absolutePath: '/project/src/a/documents.ts',
        imports: [{ specifier: './a-types', importClause: "import type { A } from './a-types';" }],
      },
    ];

    const contents = createCacheContents([], sources, '/project/src/graphql-cache.d.ts');
    const reversed = createCacheContents(
      [],
      [...sources].reverse(),
      '/project/src/graphql-cache.d.ts'
    );

    expect(reversed).toBe(contents);
    expect(contents.indexOf("from './a-types'")).toBeLessThan(contents.indexOf("from './b-types'"));
  });
});
