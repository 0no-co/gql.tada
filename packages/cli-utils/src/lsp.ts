import type { TsConfigJson } from 'type-fest';

export type GraphQLSPConfig = {
  name: string;
  schema: string;
  tadaOutputLocation?: string;
};

export function hasGraphQLSP(tsconfig: TsConfigJson): boolean {
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
