import ts from 'typescript';
import { print } from '@0no-co/graphql.web';

import type { FragmentDefinitionNode } from '@0no-co/graphql.web';
import type { GraphQLSPConfig } from '@gql.tada/internal';

import {
  findAllPersistedCallExpressions,
  getDocumentReferenceFromTypeQuery,
  getDocumentReferenceFromDocumentNode,
  unrollTadaFragments,
} from '@0no-co/graphqlsp/api';

import { programFactory, loadVirtualCode } from '../../ts';
import { expose } from '../../threads';

import type { PersistedSignal, PersistedWarning } from './types';

export interface PersistedParams {
  rootPath: string;
  configPath: string;
  pluginConfig: GraphQLSPConfig;
}

async function* _runPersisted(params: PersistedParams): AsyncIterableIterator<PersistedSignal> {
  const factory = programFactory(params);

  const getVirtualPosition = await loadVirtualCode(factory);
  if (!!getVirtualPosition) {
    yield { kind: 'EXTERNAL_WARNING' };
  }

  const container = factory.build();
  const sourceFiles = container.getSourceFiles();

  yield {
    kind: 'FILE_COUNT',
    fileCount: sourceFiles.length,
  };

  for (const sourceFile of sourceFiles) {
    let filePath = sourceFile.fileName;
    const documents: Record<string, string> = {};
    const warnings: PersistedWarning[] = [];

    const calls = findAllPersistedCallExpressions(sourceFile);
    for (const call of calls) {
      const position = container.getSourcePosition(sourceFile, call.getStart());
      filePath = position.fileName;

      const hashArg = call.arguments[0];
      const docArg = call.arguments[1];
      const typeQuery = call.typeArguments && call.typeArguments[0];
      if (!hashArg || !ts.isStringLiteral(hashArg)) {
        warnings.push({
          message:
            '"graphql.persisted" must be called with a string literal as the first argument.',
          file: position.fileName,
          line: position.line,
          col: position.col,
        });
        continue;
      } else if (!docArg && !typeQuery) {
        warnings.push({
          message:
            '"graphql.persisted" is missing a document.\n' +
            'This may be passed as a generic such as `graphql.persisted<typeof document>` or as the second argument.',
          file: position.fileName,
          line: position.line,
          col: position.col,
        });
        continue;
      }

      let foundNode: ts.CallExpression | null = null;
      let referencingNode: ts.Node = call;
      if (docArg && (ts.isCallExpression(docArg) || ts.isIdentifier(docArg))) {
        const result = getDocumentReferenceFromDocumentNode(
          docArg,
          sourceFile.fileName,
          container.buildPluginInfo(params.pluginConfig)
        );
        foundNode = result.node;
        referencingNode = docArg;
      } else if (typeQuery && ts.isTypeQueryNode(typeQuery)) {
        const result = getDocumentReferenceFromTypeQuery(
          typeQuery,
          sourceFile.fileName,
          container.buildPluginInfo(params.pluginConfig)
        );
        foundNode = result.node;
        referencingNode = typeQuery;
      }

      if (!foundNode) {
        warnings.push({
          message:
            `Could not find reference for "${referencingNode.getText()}".\n` +
            'If this is unexpected, please file an issue describing your case.',
          file: position.fileName,
          line: position.line,
          col: position.col,
        });
        continue;
      }

      if (
        !foundNode ||
        !ts.isCallExpression(foundNode) ||
        (!ts.isNoSubstitutionTemplateLiteral(foundNode.arguments[0]) &&
          !ts.isStringLiteral(foundNode.arguments[0]))
      ) {
        warnings.push({
          message:
            `The referenced document of "${referencingNode.getText()}" contains no document string literal.\n` +
            'If this is unexpected, please file an issue describing your case.',
          file: position.fileName,
          line: position.line,
          col: position.col,
        });
        continue;
      }

      const fragments: FragmentDefinitionNode[] = [];
      const operation = foundNode.arguments[0].getText().slice(1, -1);
      if (foundNode.arguments[1] && ts.isArrayLiteralExpression(foundNode.arguments[1])) {
        unrollTadaFragments(
          foundNode.arguments[1],
          fragments,
          container.buildPluginInfo(params.pluginConfig)
        );
      }

      let document = operation;
      for (const fragment of fragments) document += '\n\n' + print(fragment);
      documents[hashArg.getText().slice(1, -1)] = document;
    }

    yield {
      kind: 'FILE_PERSISTED',
      filePath,
      documents,
      warnings,
    };
  }
}

export const runPersisted = expose(_runPersisted);
