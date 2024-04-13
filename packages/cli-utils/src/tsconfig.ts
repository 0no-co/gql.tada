import type { TsConfigJson } from 'type-fest';

import { resolveTypeScriptRootDir } from '@gql.tada/internal';
import path from 'node:path';
import fs from 'node:fs/promises';
import { parse } from 'json5';

const CWD = process.cwd();

export const getTsConfig = async (target?: string): Promise<TsConfigJson | undefined> => {
  let tsconfigPath = target || CWD;
  tsconfigPath =
    path.extname(tsconfigPath) !== '.json'
      ? path.resolve(CWD, tsconfigPath, 'tsconfig.json')
      : path.resolve(CWD, tsconfigPath);

  const root = (await resolveTypeScriptRootDir(tsconfigPath)) || tsconfigPath;

  let tsconfigContents: string;
  try {
    tsconfigPath =
      path.extname(root) !== '.json'
        ? path.resolve(CWD, root, 'tsconfig.json')
        : path.resolve(CWD, root);
    tsconfigContents = await fs.readFile(tsconfigPath, 'utf-8');
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
