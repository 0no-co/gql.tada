import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { CLI_VERSION } from '../../constants';
import type { TurboDocument } from './types';

export interface CachedData {
  hashes: Map<string, string>;
  documents: Map<string, TurboDocument[]>;
}

/**
 * Creates a content hash from tada output file content and source file content
 */
export function createContentHash(tadaOutputFileContent: string, content: string): string {
  const hashInput = `${tadaOutputFileContent}-${CLI_VERSION}-${content}`;
  return crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}

/**
 * Parses cached data from existing cache file for change detection
 */
export function parseCachedData(
  cacheFilePath: string,
  schemaNames: Set<string | null>
): CachedData {
  const cachedHashes = new Map<string, string>();
  const cachedDocuments = new Map<string, TurboDocument[]>();

  try {
    if (!fs.existsSync(cacheFilePath)) {
      return { hashes: cachedHashes, documents: cachedDocuments };
    }

    const cacheContent = fs.readFileSync(cacheFilePath, 'utf-8');

    // Parse comments to get file -> hash mapping
    const commentRegex = /\/\/ ([^:]+): ([a-f0-9]+)/g;
    let match: RegExpExecArray | null;

    while ((match = commentRegex.exec(cacheContent)) !== null) {
      const [, fileName, hash] = match;
      cachedHashes.set(fileName.trim(), hash);
    }

    // Parse documents from cache content
    const setupCacheMatch = cacheContent.match(/interface setupCache \{([\s\S]*?)\n  \}/);
    if (setupCacheMatch) {
      const cacheBody = setupCacheMatch[1];

      // Split by comment lines to process each file group
      const commentRegex = /^\s*\/\/ ([^:]+): ([a-f0-9]+)$/gm;
      const parts = cacheBody.split(commentRegex);

      // Process in groups of 3: [content_before_comment, fileName, hash, content_after_comment, ...]
      for (let i = 1; i < parts.length; i += 3) {
        const fileName = parts[i];
        const hash = parts[i + 1];
        const content = parts[i + 2] || '';

        // Parse document entries from this file's content
        // This regex matches: "key":\n      type_content;
        // where type_content can span multiple lines until we hit a semicolon at the end of a line
        const docRegex = /^\s*"([^"]*(?:\\.[^"]*)*)":\s*\n([\s\S]*?);$/gm;
        let docMatch: RegExpExecArray | null;

        while ((docMatch = docRegex.exec(content)) !== null) {
          const argumentKey = `"${docMatch[1]}"`;
          const documentType = docMatch[2].trim();

          // Create documents for this file
          if (!cachedDocuments.has(fileName)) {
            cachedDocuments.set(fileName, []);
          }

          // For single schema setups, use the schema name; for multi-schema, we'll update later
          const schemaName = schemaNames.size === 1 ? Array.from(schemaNames)[0] : null;

          cachedDocuments.get(fileName)!.push({
            schemaName,
            argumentKey,
            documentType,
            fileName,
            contentHash: hash,
          });
        }
      }
    }
  } catch (error) {
    // If we can't read the cache file, just proceed without skipping
  }

  return { hashes: cachedHashes, documents: cachedDocuments };
}
