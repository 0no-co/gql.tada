import { Project, ts } from 'ts-morph';
import path from 'node:path';

import { getTsConfig } from '../tsconfig';
import type { GraphQLSPConfig } from '../lsp';
import { getGraphQLSPConfig } from '../lsp';
import { createPluginInfo } from '../ts/project';

export async function generateGraphQLCache() {
  const tsConfig = await getTsConfig();
  if (!tsConfig) {
    return;
  }

  const config = getGraphQLSPConfig(tsConfig);
  if (!config) {
    return;
  }

  await getPersistedOperationsFromFiles(config);
}

async function getPersistedOperationsFromFiles(
  config: GraphQLSPConfig
): Promise<Record<string, string>> {
  // TODO: leverage ts-morph tsconfig resolver
  const projectName = path.resolve(process.cwd(), 'tsconfig.json');
  const project = new Project({
    tsConfigFilePath: projectName,
  });

  const pluginCreateInfo = createPluginInfo(project, config, projectName);

  const sourceFiles = project.getSourceFiles();

  return sourceFiles.reduce((acc, sourceFile) => {
    const tadaCallExpressions = findAllCallExpressions(sourceFile.compilerNode, pluginCreateInfo);
    return {
      ...acc,
      ...tadaCallExpressions.reduce((acc, callExpression) => {
        const typeChecker = project.getTypeChecker().compilerObject;
        const resolvedSignature = typeChecker.getResolvedSignature(callExpression);
        if (!resolvedSignature) {
          return acc;
        }

        const returnType = resolvedSignature.getReturnType();
        acc[callExpression.getText()] = typeChecker.typeToString(returnType);
        return acc;
      }, {}),
    };
  }, {});
}

function findAllCallExpressions(
  sourceFile: ts.SourceFile,
  info: ts.server.PluginCreateInfo
): Array<ts.CallExpression> {
  const result: Array<ts.CallExpression> = [];
  const templates = new Set([info.config.template, 'graphql', 'gql'].filter(Boolean));
  function find(node: ts.Node) {
    if (ts.isCallExpression(node) && templates.has(node.expression.getText())) {
      result.push(node);
      return;
    } else {
      ts.forEachChild(node, find);
    }
  }
  find(sourceFile);
  return result;
}
