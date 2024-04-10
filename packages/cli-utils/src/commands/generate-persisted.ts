import { Project, ts } from 'ts-morph';
import { print } from '@0no-co/graphql.web';
import {
  init,
  findAllPersistedCallExpressions,
  getDocumentReferenceFromTypeQuery,
  unrollTadaFragments,
} from '@0no-co/graphqlsp/api';
import { load, resolveTypeScriptRootDir } from '@gql.tada/internal';
import path from 'node:path';
import fs from 'node:fs/promises';

import { getTsConfig } from '../tsconfig';
import type { GraphQLSPConfig } from '../lsp';
import { getGraphQLSPConfig } from '../lsp';
import { createPluginInfo } from '../ts/project';

export async function generatePersisted(target: string) {
  const tsConfig = await getTsConfig();
  if (!tsConfig) {
    return;
  }

  const config = getGraphQLSPConfig(tsConfig);
  if (!config) {
    return;
  }

  const persistedOperations = await getPersistedOperationsFromFiles(config);

  return fs.writeFile(target, JSON.stringify(persistedOperations, null, 2));
}

async function getPersistedOperationsFromFiles(
  config: GraphQLSPConfig
): Promise<Record<string, string>> {
  // TODO: leverage ts-morph tsconfig resolver
  const projectName = path.resolve(process.cwd(), 'tsconfig.json');
  const rootPath = (await resolveTypeScriptRootDir(projectName)) || path.dirname(projectName);
  const project = new Project({
    tsConfigFilePath: projectName,
  });

  init({
    typescript: ts as any,
  });

  const pluginCreateInfo = createPluginInfo(project, config, projectName);

  const sourceFiles = project.getSourceFiles();
  const loader = load({ origin: config.schema, rootPath });
  let schema;
  try {
    const loaderResult = await loader.load();
    schema = loaderResult && loaderResult.schema;
    if (!schema) {
      throw new Error(`Failed to load schema`);
    }
  } catch (error) {
    throw new Error(`Failed to load schema: ${error}`);
  }

  return sourceFiles.reduce((acc, sourceFile) => {
    const persistedCallExpressions = findAllPersistedCallExpressions(sourceFile.compilerNode);
    return {
      ...acc,
      ...persistedCallExpressions.reduce((acc, callExpression) => {
        const hash = callExpression.arguments[0].getText();
        if (!callExpression.typeArguments) {
          return acc;
        }
        const [typeQuery] = callExpression.typeArguments;
        if (!ts.isTypeQueryNode(typeQuery)) {
          return acc;
        }

        const { node: foundNode } = getDocumentReferenceFromTypeQuery(
          typeQuery,
          sourceFile.compilerNode.fileName,
          pluginCreateInfo
        );

        if (!foundNode) {
          return acc;
        }

        const initializer = foundNode.initializer;
        if (
          !initializer ||
          !ts.isCallExpression(initializer) ||
          !ts.isNoSubstitutionTemplateLiteral(initializer.arguments[0])
        ) {
          return acc;
        }

        const fragments = [];
        const operation = initializer.arguments[0].getText().slice(1, -1);
        if (initializer.arguments[1] && ts.isArrayLiteralExpression(initializer.arguments[1])) {
          unrollTadaFragments(initializer.arguments[1], fragments, pluginCreateInfo);
        }

        const document = `${operation}\n${fragments.map((frag) => print(frag)).join('\n')}`;
        acc[hash.slice(1, -1)] = document;
        return acc;
      }, {}),
    };
  }, {});
}
