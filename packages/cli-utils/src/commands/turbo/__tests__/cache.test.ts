import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { describe, it, expect } from 'vitest';

import { readCachedTurboDocuments } from '../cache';

describe('readCachedTurboDocuments', () => {
  it('reads document hashes and cached document types', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'gql-tada-cache-'));
    const cachePath = path.join(rootPath, 'graphql-cache.d.ts');

    try {
      await fs.writeFile(
        cachePath,
        [
          '/* eslint-disable */',
          "import type { TadaDocumentNode } from 'gql.tada';",
          '',
          "declare module 'gql.tada' {",
          ' interface setupCache {',
          '    /** @gql.tada/hash sha256:first */',
          '    "query First { id }":',
          '      TadaDocumentNode<{ id: string; }, {}, void>;',
          '    /** @gql.tada/hash sha256:second */',
          '    "fragment Second on Todo { id }":',
          '      TadaDocumentNode<',
          '        { id: string; },',
          '        {},',
          '        { fragment: "Second"; on: "Todo"; masked: true; }',
          '      >;',
          '  }',
          '}',
        ].join('\n')
      );

      const documents = readCachedTurboDocuments(cachePath);

      expect(documents.get('"query First { id }"')).toEqual({
        documentHash: 'sha256:first',
        documentType: 'TadaDocumentNode<{ id: string; }, {}, void>',
      });
      expect(documents.get('"fragment Second on Todo { id }"')).toEqual({
        documentHash: 'sha256:second',
        documentType:
          'TadaDocumentNode<\n' +
          '        { id: string; },\n' +
          '        {},\n' +
          '        { fragment: "Second"; on: "Todo"; masked: true; }\n' +
          '      >',
      });
    } finally {
      await fs.rm(rootPath, { recursive: true, force: true });
    }
  });
});
