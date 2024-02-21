import sade from 'sade';
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
// We use comment-json to parse the tsconfig as the default ones
// have comment annotations in JSON.
import { parse } from 'comment-json';
import type { TsConfigJson } from 'type-fest';
import { ensureTadaIntrospection } from './tada';

const prog = sade('gql.tada');

prog.version(process.env.npm_package_version || '0.0.0');

type GraphQLSPConfig = {
  name: string;
  schema: string;
  tadaOutputLocation?: string;
};

function hasGraphQLSP(tsconfig: TsConfigJson): boolean {
  if (!tsconfig.compilerOptions) {
    console.warn('Missing compilerOptions object in tsconfig.json.');
    return false;
  }

  if (!tsconfig.compilerOptions.plugins) {
    console.warn('Missing plugins array in tsconfig.json.');
    return false;
  }

  const foundPlugin = tsconfig.compilerOptions.plugins.find(
    (plugin) => plugin.name === '@0no-co/graphqlsp'
  ) as GraphQLSPConfig | undefined;
  if (!foundPlugin) {
    console.warn('Missing @0no-co/graphqlsp plugin in tsconfig.json.');
    return false;
  }

  if (!foundPlugin.schema) {
    console.warn('Missing schema property in @0no-co/graphqlsp plugin in tsconfig.json.');
    return false;
  }

  if (!foundPlugin.tadaOutputLocation) {
    console.warn(
      'Missing tadaOutputLocation property in @0no-co/graphqlsp plugin in tsconfig.json.'
    );
    return false;
  }

  return true;
}

async function main() {
  prog
    .command('generate')
    .describe(
      'Generate the gql.tada types file, this will look for your "tsconfig.json" and use the "@0no-co/graphqlsp" configuration to generate the file.'
    )
    .action(async () => {
      const cwd = process.cwd();
      const tsconfigpath = path.resolve(cwd, 'tsconfig.json');
      const hasTsConfig = existsSync(tsconfigpath);
      if (!hasTsConfig) {
        console.error('Missing tsconfig.json');
        return;
      }

      const tsconfigContents = await fs.readFile(tsconfigpath, 'utf-8');
      let tsConfig: TsConfigJson;
      try {
        tsConfig = parse(tsconfigContents) as TsConfigJson;
      } catch (err) {
        console.error(err);
        return;
      }

      if (!hasGraphQLSP(tsConfig)) {
        return;
      }

      const foundPlugin = tsConfig.compilerOptions!.plugins!.find(
        (plugin) => plugin.name === '@0no-co/graphqlsp'
      ) as GraphQLSPConfig;

      await ensureTadaIntrospection(foundPlugin.schema, foundPlugin.tadaOutputLocation!);
    });
  prog.parse(process.argv);
}

export default main;
