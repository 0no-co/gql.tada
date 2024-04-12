import type { TsConfigJson } from 'type-fest';

import { resolveTypeScriptRootDir } from '@gql.tada/internal';
import path from 'node:path';
import fs from 'node:fs/promises';
import { parse } from 'json5';

export const getTsConfig = async (target = process.cwd()): Promise<TsConfigJson | undefined> => {
  const tsconfigpath =
    path.extname(target) !== '.json' ? path.resolve(target, 'tsconfig.json') : target;
  const root = (await resolveTypeScriptRootDir(tsconfigpath)) || target;

  let tsconfigContents: string;
  try {
    const tsconfigpath =
      path.extname(root) !== '.json' ? path.resolve(root, 'tsconfig.json') : root;
    tsconfigContents = await fs.readFile(tsconfigpath, 'utf-8');
  } catch (error) {
    console.error('Failed to read tsconfig.json in current working directory.', error);
    return;
  }

  let tsConfig: TsConfigJson;
  try {
    tsConfig = parse<TsConfigJson>(tsconfigContents);
  } catch (err) {
    console.error(err);
    return;
  }

  return tsConfig;
};
