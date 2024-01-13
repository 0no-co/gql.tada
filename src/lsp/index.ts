import type ts from 'typescript/lib/tsserverlibrary';
import initGraphQLSP from '@0no-co/graphqlsp';

const init: ts.server.PluginModuleFactory = (ts) => {
  const { create } = initGraphQLSP(ts);
  return {
    create(info) {
      return create({
        ...info,
        config: {
          ...info.config,
          schema: info.config.schema,
          disableTypegen: true,
          shouldCheckForColocatedFragments: true,
          templateIsCallExpression: true,
          template: 'graphql',
        },
      });
    },
  };
};

export default init;
