import ts from 'typescript';
import type { GraphQLSPConfig } from '@gql.tada/internal';

import { getSchemaNamesFromConfig } from '@gql.tada/internal';
import { findAllCallExpressions } from '@0no-co/graphqlsp/api';

import { programFactory } from '../../ts';
import { expose } from '../../threads';

import type { TurboSignal, TurboWarning, TurboDocument } from './types';

export interface TurboParams {
  rootPath: string;
  configPath: string;
  pluginConfig: GraphQLSPConfig;
}

async function* _runTurbo(params: TurboParams): AsyncIterableIterator<TurboSignal> {
  const schemaNames = getSchemaNamesFromConfig(params.pluginConfig);
  const factory = programFactory(params);

  // NOTE: We add our override declaration here before loading all files
  // This sets `__cacheDisabled` on the turbo cache, which disables the cache temporarily
  // If we don't disable the cache then we couldn't regenerate it from inferred types
  factory.addSourceFile({
    fileId: '__gql-tada-override__.d.ts',
    sourceText: DECLARATION_OVERRIDE,
    scriptKind: ts.ScriptKind.TS,
  });

  const externalFiles = factory.createExternalFiles();
  if (externalFiles.length) {
    yield { kind: 'EXTERNAL_WARNING' };
    await factory.addVirtualFiles(externalFiles);
  }

  const container = factory.build();
  const pluginInfo = container.buildPluginInfo(params.pluginConfig);
  const sourceFiles = container.getSourceFiles();

  yield {
    kind: 'FILE_COUNT',
    fileCount: sourceFiles.length,
  };

  const checker = container.program.getTypeChecker();
  for (const sourceFile of sourceFiles) {
    let filePath = sourceFile.fileName;
    const documents: TurboDocument[] = [];
    const warnings: TurboWarning[] = [];

    const calls = findAllCallExpressions(sourceFile, pluginInfo, false).nodes;
    for (const call of calls) {
      const callExpression = call.node.parent;
      if (!ts.isCallExpression(callExpression)) {
        continue;
      }

      const position = container.getSourcePosition(sourceFile, callExpression.getStart());
      filePath = position.fileName;
      if (!schemaNames.has(call.schema)) {
        warnings.push({
          message: call.schema
            ? `The '${call.schema}' schema is not in the configuration but was referenced by document.`
            : schemaNames.size > 1
              ? 'The document is not for a known schema. Have you re-generated the output file?'
              : 'Multiple schemas are configured, but the document is not for a specific schema.',
          file: position.fileName,
          line: position.line,
          col: position.col,
        });
        continue;
      }

      const returnType = checker.getTypeAtLocation(callExpression);
      const argumentType = checker.getTypeAtLocation(call.node);
      // NOTE: `returnType.symbol` is incorrectly typed and is in fact
      // optional and not always present
      if (!returnType.symbol || returnType.symbol.getEscapedName() !== 'TadaDocumentNode') {
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

      const argumentKey: string =
        'value' in argumentType &&
        typeof argumentType.value === 'string' &&
        (argumentType.flags & ts.TypeFlags.StringLiteral) === 0
          ? JSON.stringify(argumentType.value)
          : checker.typeToString(argumentType, callExpression, BUILDER_FLAGS);
      const documentType = checker.typeToString(returnType, callExpression, BUILDER_FLAGS);

      documents.push({
        schemaName: call.schema,
        argumentKey,
        documentType,
      });
    }

    yield {
      kind: 'FILE_TURBO',
      filePath,
      documents,
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
