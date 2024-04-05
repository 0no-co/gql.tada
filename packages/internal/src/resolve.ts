import path from 'path';
import JSON5 from 'json5';
import fs from 'node:fs/promises';
import type { TsConfigJson } from 'type-fest';
import { TsConfigResolver } from '@ts-morph/common';

// TODO: Replace config loading with typescript package's native config loading
export const resolveTypeScriptRootDir = async (
  tsconfigPath: string
): Promise<string | undefined> => {
  const tsconfigContents = await fs.readFile(tsconfigPath, { encoding: 'utf8' });
  const parsed = JSON5.parse<TsConfigJson>(tsconfigContents);

  if (
    parsed.compilerOptions &&
    parsed.compilerOptions.plugins &&
    parsed.compilerOptions.plugins.find(
      (x) => x.name === '@0no-co/graphqlsp' || x.name === 'gql.tada/lsp'
    )
  ) {
    return path.dirname(tsconfigPath);
  } else if (Array.isArray(parsed.extends)) {
    return parsed.extends.find((p) => {
      // TODO: This doesn't account for *.json being omitted
      // See: https://www.typescriptlang.org/tsconfig#extends
      const resolved = require.resolve(p, {
        paths: [path.dirname(tsconfigPath)],
      });
      return resolveTypeScriptRootDir(resolved);
    });
  } else if (parsed.extends) {
    const resolved = require.resolve(parsed.extends, {
      paths: [path.dirname(tsconfigPath)],
    });
    return resolveTypeScriptRootDir(resolved);
  }
};
