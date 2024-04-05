import { resolveTypeScriptRootDir } from '@gql.tada/internal';
import path from 'path';
import type { TsConfigJson } from 'type-fest';
import fs from 'node:fs/promises';
import { parse } from 'json5';

export const getTsConfig = async (): Promise<TsConfigJson | undefined> => {
  const cwd = process.cwd();
  const tsconfigpath = path.resolve(cwd, 'tsconfig.json');

  // TODO: Remove redundant read and move tsconfig.json handling to internal package
  const root = (await resolveTypeScriptRootDir(tsconfigpath)) || cwd;

  let tsconfigContents: string;
  try {
    const file = path.resolve(root, 'tsconfig.json');
    tsconfigContents = await fs.readFile(file, 'utf-8');
  } catch (error) {
    console.error('Failed to read tsconfig.json in current working directory.', error);
    return;
  }

  let tsConfig: TsConfigJson;
  try {
    tsConfig = parse(tsconfigContents) as TsConfigJson;
  } catch (err) {
    console.error(err);
    return;
  }

  return tsConfig;
};
