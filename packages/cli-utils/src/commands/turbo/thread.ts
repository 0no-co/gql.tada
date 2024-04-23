import ts from 'typescript';
import type { GraphQLSPConfig } from '@gql.tada/internal';

import { programFactory, loadVirtualCode } from '../../ts';
import { expose } from '../../threads';

import type { TurboSignal, TurboWarning } from './types';

export interface TurboParams {
  rootPath: string;
  configPath: string;
  pluginConfig: GraphQLSPConfig;
}

async function* _runTurbo(params: TurboParams): AsyncIterableIterator<TurboSignal> {
  const factory = programFactory(params);

  // NOTE: We add our override declaration here before loading all files
  // This sets `__cacheDisabled` on the turbo cache, which disables the cache temporarily
  // If we don't disable the cache then we couldn't regenerate it from inferred types
  factory.addSourceFile({
    fileId: '__gql-tada-override__.d.ts',
    sourceText: DECLARATION_OVERRIDE,
    scriptKind: ts.ScriptKind.TS,
  });

  const virtualFiles = await loadVirtualCode(factory);
  if (virtualFiles.length) {
    yield { kind: 'EXTERNAL_WARNING' };
  }

  const container = factory.build();
  const sourceFiles = container.getSourceFiles();

  yield {
    kind: 'FILE_COUNT',
    fileCount: sourceFiles.length,
  };

  const checker = container.program.getTypeChecker();
  for (const sourceFile of sourceFiles) {
    let filePath = sourceFile.fileName;
    const cache: Record<string, string> = {};
    const warnings: TurboWarning[] = [];

    const calls = findAllCallExpressions(sourceFile, params.pluginConfig);
    for (const call of calls) {
      const returnType = checker.getTypeAtLocation(call);
      const argumentType = checker.getTypeAtLocation(call.arguments[0]);
      // NOTE: `returnType.symbol` is incorrectly typed and is in fact
      // optional and not always present
      if (!returnType.symbol || returnType.symbol.getEscapedName() !== 'TadaDocumentNode') {
        const position = container.getSourcePosition(sourceFile, call.getStart());
        filePath = position.fileName;
        warnings.push({
          message:
            `The discovered document is not of type "TadaDocumentNode".\n` +
            'If this is unexpected, please file an issue describing your case.',
          file: position.fileName,
          line: position.line,
          col: position.col,
        });
        continue;
      }

      const key: string =
        'value' in argumentType &&
        typeof argumentType.value === 'string' &&
        (argumentType.flags & ts.TypeFlags.StringLiteral) === 0
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

const BUILDER_FLAGS: ts.TypeFormatFlags =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.NoTypeReduction |
  ts.TypeFormatFlags.InTypeAlias |
  ts.TypeFormatFlags.UseFullyQualifiedType |
  ts.TypeFormatFlags.GenerateNamesForShadowedTypeParams |
  ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
  ts.TypeFormatFlags.AllowUniqueESSymbolType |
  ts.TypeFormatFlags.WriteTypeArgumentsOfSignature;

const DECLARATION_OVERRIDE = `
import * as _gqlTada from 'gql.tada';
declare module 'gql.tada' {
  interface setupCache {
    readonly __cacheDisabled: true;
  }
}
`.trim();

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
