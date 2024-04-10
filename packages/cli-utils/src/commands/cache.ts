import { Project, TypeFormatFlags, TypeFlags, ts } from 'ts-morph';
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
  return `import type { TadaDocumentNode, $tada } from 'gql.tada';

declare module 'gql.tada' {
  interface setupCache {
    ${Object.keys(cache).reduce((acc, key) => {
      const value = cache[key];
      return `${acc}\n${JSON.stringify(key)}: ${value}`;
    }, '')}
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
  const typeChecker = project.getTypeChecker().compilerObject;
  const sourceFiles = project.getSourceFiles();

  return sourceFiles.reduce((acc, sourceFile) => {
    const tadaCallExpressions = findAllCallExpressions(sourceFile.compilerNode, pluginCreateInfo);
    return {
      ...acc,
      ...tadaCallExpressions.reduce((acc, callExpression) => {
        // TODO: We can't trust the `returnType` here, because it may use
        // the prior cache. It'd be a little unreliable to rely on deletion
        // timing here. Maybe there's a better way to filter it out in `Project`?
        const returnType = typeChecker.getTypeAtLocation(callExpression);
        const argumentType = typeChecker.getTypeAtLocation(callExpression.arguments[0]);
        if (returnType.symbol.getEscapedName() !== 'TadaDocumentNode') {
          return acc; // TODO: we could collect this and warn if all extracted types have some kind of error
        } else if ((argumentType.flags & TypeFlags.StringLiteral) === 0) {
          return acc; // TODO: we could collect this and warn if all extracted types have some kind of error
        }

        const valueString = typeChecker.typeToString(returnType, callExpression, BUILDER_FLAGS);
        const keyString =
          !('value' in argumentType) || typeof argumentType.value !== 'string'
            ? JSON.parse(typeChecker.typeToString(argumentType, callExpression, BUILDER_FLAGS))
            : argumentType.value;
        acc[keyString] = valueString;
        return acc;
      }, {}),
    };
  }, {});
}

const BUILDER_FLAGS: TypeFormatFlags =
  TypeFormatFlags.NoTruncation |
  TypeFormatFlags.NoTypeReduction |
  TypeFormatFlags.InTypeAlias |
  TypeFormatFlags.UseFullyQualifiedType |
  TypeFormatFlags.GenerateNamesForShadowedTypeParams |
  TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
  TypeFormatFlags.AllowUniqueESSymbolType |
  TypeFormatFlags.WriteTypeArgumentsOfSignature;

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
