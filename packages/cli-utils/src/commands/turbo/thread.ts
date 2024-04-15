import * as path from 'node:path';
import { Project, TypeFormatFlags, TypeFlags, ts } from 'ts-morph';

import type { GraphQLSPConfig } from '@gql.tada/internal';
import { init } from '@0no-co/graphqlsp/api';

import { getFilePosition } from '../../ts';
import { expose } from '../../threads';

import type { TurboSignal, TurboWarning } from './types';

export interface TurboParams {
  rootPath: string;
  configPath: string;
  pluginConfig: GraphQLSPConfig;
}

async function* _runTurbo(params: TurboParams): AsyncIterableIterator<TurboSignal> {
  init({ typescript: ts as any });

  const projectPath = path.dirname(params.configPath);
  const project = new Project({ tsConfigFilePath: params.configPath });
  const checker = project.getTypeChecker().compilerObject;

  // Filter source files by whether they're under the relevant root path
  const sourceFiles = project.getSourceFiles().filter((sourceFile) => {
    const filePath = path.resolve(projectPath, sourceFile.getFilePath());
    const relative = path.relative(params.rootPath, filePath);
    return !relative.startsWith('..');
  });

  yield {
    kind: 'FILE_COUNT',
    fileCount: sourceFiles.length,
  };

  for (const { compilerNode: sourceFile } of sourceFiles) {
    const filePath = sourceFile.fileName;
    const cache: Record<string, string> = {};
    const warnings: TurboWarning[] = [];

    const calls = findAllCallExpressions(sourceFile, params.pluginConfig);
    for (const call of calls) {
      const returnType = checker.getTypeAtLocation(call);
      const argumentType = checker.getTypeAtLocation(call.arguments[0]);
      // NOTE: `returnType.symbol` is incorrectly typed and is in fact
      // optional and not always present
      if (!returnType.symbol || returnType.symbol.getEscapedName() !== 'TadaDocumentNode') {
        const position = getFilePosition(sourceFile, call.getStart());
        warnings.push({
          message:
            `The discovered document is not of type "TadaDocumentNode".\n` +
            'If this is unexpected, please file an issue describing your case.',
          file: filePath,
          line: position.line,
          col: position.col,
        });
        continue;
      }
      const key: string =
        'value' in argumentType &&
        typeof argumentType.value === 'string' &&
        (argumentType.flags & TypeFlags.StringLiteral) === 0
          ? JSON.stringify(argumentType.value)
          : checker.typeToString(argumentType, call, BUILDER_FLAGS);
      cache[key] = checker.typeToString(returnType, call, BUILDER_FLAGS);
    }

    yield {
      kind: 'FILE_TURBO',
      filePath,
      cache,
      warnings,
    };
  }
}

export const runTurbo = expose(_runTurbo);

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
  config: GraphQLSPConfig
): Array<ts.CallExpression> {
  const result: ts.CallExpression[] = [];
  const templates = new Set([config.template, 'graphql', 'gql'].filter(Boolean));
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
