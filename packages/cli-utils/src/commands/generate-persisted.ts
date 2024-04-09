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
    const currentFilename = sourceFile.compilerNode.fileName;
    return {
      ...acc,
      ...persistedCallExpressions.reduce((acc, callExpression) => {
        const hash = callExpression.arguments[0].getText();
        if (!callExpression.typeArguments) {
          console.warn(
            `Persisted call expression in "${currentFilename}" is missing a type argument like "graphql.persisted<typeof document>". Skipping...`
          );
          return acc;
        }
        const [typeQuery] = callExpression.typeArguments;
        if (!ts.isTypeQueryNode(typeQuery)) {
          console.warn(
            `Persisted call expression in "${currentFilename}" is missing a type argument like "graphql.persisted<typeof document>". Skipping...`
          );
          return acc;
        }

        const { node: foundNode } = getDocumentReferenceFromTypeQuery(
          typeQuery,
          currentFilename,
          pluginCreateInfo
        );

        if (!foundNode) {
          console.warn(
            `Could not find reference for "${typeQuery.getText()}" in "${currentFilename}", if this is unexpected file an issue at "https://github.com/0no-co/gql.tada/issues/new/choose" describing your case.`
          );
          return acc;
        }

        const initializer = foundNode.initializer;
        if (
          !initializer ||
          !ts.isCallExpression(initializer) ||
          (!ts.isNoSubstitutionTemplateLiteral(initializer.arguments[0]) &&
            !ts.isStringLiteral(initializer.arguments[0]))
        ) {
          console.warn(
            `Persisted call expression in "${currentFilename}" is missing a string argument containing the hash. Skipping...`
          );
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
