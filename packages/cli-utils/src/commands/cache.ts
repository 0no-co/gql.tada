import { Project, TypeFormatFlags, ts } from 'ts-morph';
import { EmitHint, NewLineKind, createPrinter } from 'typescript';
import path from 'node:path';
import fs from 'node:fs/promises';

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

  const cache = await getGraphqlInvocationCache(config);
  await fs.writeFile(
    path.resolve(config.tadaOutputLocation, '..', 'graphql-cache.d.ts'),
    createCache(cache),
    'utf-8'
  );
}

function createCache(cache: Record<string, string>): string {
  return `import * as gqlTada from 'gql.tada';

declare module 'gql.tada' {
  interface Cache {
    properties: { ${Object.keys(cache).reduce((acc, key) => {
      const value = cache[key];
      return `${acc}\n${JSON.stringify(key)}: ${value}`;
    }, '')} }
  }
}\n`;
}

async function getGraphqlInvocationCache(config: GraphQLSPConfig): Promise<Record<string, string>> {
  // TODO: leverage ts-morph tsconfig resolver
  const projectName = path.resolve(process.cwd(), 'tsconfig.json');
  const project = new Project({
    tsConfigFilePath: projectName,
  });

  const pluginCreateInfo = createPluginInfo(project, config, projectName);

  const sourceFiles = project.getSourceFiles();
  const printer = createPrinter({
    newLine: NewLineKind.LineFeed,
    removeComments: true,
    omitTrailingSemicolon: true,
    noEmitHelpers: true,
  });

  return sourceFiles.reduce((acc, sourceFile) => {
    const tadaCallExpressions = findAllCallExpressions(sourceFile.compilerNode, pluginCreateInfo);
    return {
      ...acc,
      ...tadaCallExpressions.reduce((acc, callExpression) => {
        const typeChecker = project.getTypeChecker().compilerObject;
        const resolvedSignature = typeChecker.getResolvedSignature(callExpression);
        if (!resolvedSignature) return acc;

        const returnType = resolvedSignature.getReturnType();
        const typeNode = typeChecker.typeToTypeNode(returnType, undefined, BUILDER_FLAGS);
        if (!typeNode) return acc;
        acc[callExpression.arguments[0].getText().slice(1, -1)] = printer.printNode(
          EmitHint.Unspecified,
          typeNode,
          sourceFile.compilerNode
        );
        return acc;
      }, {}),
    };
  }, {});
}

const BUILDER_FLAGS =
  TypeFormatFlags.NoTruncation |
  TypeFormatFlags.NoTypeReduction |
  TypeFormatFlags.InTypeAlias |
  TypeFormatFlags.UseFullyQualifiedType |
  TypeFormatFlags.GenerateNamesForShadowedTypeParams;

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
