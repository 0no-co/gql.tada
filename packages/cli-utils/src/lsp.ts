import type { TsConfigJson } from 'type-fest';
import type { SchemaOrigin } from '@gql.tada/internal';

export type GraphQLSPConfig = {
  name: string;
  schema: SchemaOrigin;
  tadaOutputLocation: string;
};

export function getGraphQLSPConfig(tsconfig: TsConfigJson): GraphQLSPConfig | null {
  if (tsconfig.compilerOptions) {
    if (tsconfig.compilerOptions.plugins) {
      const foundPlugin = tsconfig.compilerOptions.plugins.find(
        (plugin) => plugin.name === '@0no-co/graphqlsp' || plugin.name === 'gql.tada/lsp'
      ) as GraphQLSPConfig | undefined;
      if (!foundPlugin) {
        console.error('Missing @0no-co/graphqlsp plugin in tsconfig.json.');
        return null;
      }

      if (!foundPlugin.schema) {
        console.warn('Missing schema property in @0no-co/graphqlsp plugin in tsconfig.json.');
        return null;
      }

      if (!foundPlugin.tadaOutputLocation) {
        console.warn(
          'Missing tadaOutputLocation property in @0no-co/graphqlsp plugin in tsconfig.json.'
        );
        return null;
      }

      return foundPlugin;
    } else {
      console.warn('Missing plugins array in tsconfig.json.');
      return null;
    }
  } else {
    console.warn('Missing compilerOptions object in tsconfig.json.');
    return null;
  }
}
