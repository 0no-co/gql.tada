import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { IntrospectionQuery } from 'graphql';

import {
  minifyIntrospection,
  outputIntrospectionFile,
  resolveTypeScriptRootDir,
  load,
} from '@gql.tada/internal';

import type { TTY } from '../../term';
import { getGraphQLSPConfig } from '../../lsp';
import { getTsConfig } from '../../tsconfig';

interface Options {
  disablePreprocessing: boolean;
  output: string | undefined;
  tsconfig: string | undefined;
}

const CWD = process.cwd();

export async function run(tty: TTY, opts: Options) {
  const tsConfig = await getTsConfig(opts.tsconfig);
  if (!tsConfig) {
    return;
  }

  const config = getGraphQLSPConfig(tsConfig);
  if (!config) {
    return;
  }

  let tsconfigPath = opts.tsconfig || CWD;
  tsconfigPath =
    path.extname(tsconfigPath) !== '.json'
      ? path.resolve(CWD, tsconfigPath, 'tsconfig.json')
      : path.resolve(CWD, tsconfigPath);
  const rootPath = (await resolveTypeScriptRootDir(tsconfigPath)) || path.dirname(tsconfigPath);

  // TODO: allow this to be overwritten using arguments (like in `generate schema`)
  const loader = load({
    origin: config.schema,
    rootPath,
  });

  let introspection: IntrospectionQuery | null;
  try {
    introspection = await loader.loadIntrospection();
  } catch (error) {
    console.error('Something went wrong while trying to load the schema.', error);
    return;
  }

  if (!introspection) {
    console.error('Could not retrieve introspection schema.');
    return;
  }

  try {
    const contents = outputIntrospectionFile(minifyIntrospection(introspection), {
      fileType: config.tadaOutputLocation,
      shouldPreprocess: !opts.disablePreprocessing,
    });

    let destination: string;
    if (!opts.output && tty.pipeTo) {
      tty.pipeTo.write(contents);
      return;
    } else if (!opts.output) {
      destination = path.resolve(rootPath, config.tadaOutputLocation);
    } else {
      destination = path.resolve(CWD, opts.output);
    }

    await fs.writeFile(destination, contents);
  } catch (error) {
    console.error('Something went wrong while writing the introspection file', error);
  }
}
