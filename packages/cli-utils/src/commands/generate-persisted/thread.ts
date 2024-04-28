import ts from 'typescript';
import { parse, print } from '@0no-co/graphql.web';

import type { FragmentDefinitionNode } from '@0no-co/graphql.web';
import type { GraphQLSPConfig } from '@gql.tada/internal';
import { getSchemaNamesFromConfig } from '@gql.tada/internal';

import {
  findAllPersistedCallExpressions,
  getDocumentReferenceFromTypeQuery,
  getDocumentReferenceFromDocumentNode,
  unrollTadaFragments,
} from '@0no-co/graphqlsp/api';

import { programFactory } from '../../ts';
import { expose } from '../../threads';

import type { PersistedSignal, PersistedWarning, PersistedDocument } from './types';

export interface PersistedParams {
  disableNormalization: boolean;
  rootPath: string;
  configPath: string;
  pluginConfig: GraphQLSPConfig;
}

async function* _runPersisted(params: PersistedParams): AsyncIterableIterator<PersistedSignal> {
  const schemaNames = getSchemaNamesFromConfig(params.pluginConfig);
  const factory = programFactory(params);

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

  for (const sourceFile of sourceFiles) {
    let filePath = sourceFile.fileName;
    const documents: PersistedDocument[] = [];
    const warnings: PersistedWarning[] = [];

    const calls = findAllPersistedCallExpressions(sourceFile, pluginInfo);
    for (const call of calls) {
      const position = container.getSourcePosition(sourceFile, call.node.getStart());
      filePath = position.fileName;

      if (!schemaNames.has(call.schema)) {
        warnings.push({
          message: call.schema
            ? `The '${call.schema}' schema is not in the configuration but was referenced by "graphql.persisted".`
            : schemaNames.size > 1
              ? 'The document is not for a known schema. Have you re-generated the output file?'
              : 'Multiple schemas are configured, but the document is not for a specific schema.',
          file: position.fileName,
          line: position.line,
          col: position.col,
        });
        continue;
      }

      const hashArg = call.node.arguments[0];
      const docArg = call.node.arguments[1];
      const typeQuery = call.node.typeArguments && call.node.typeArguments[0];
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
      let referencingNode: ts.Node = call.node;
      if (docArg && (ts.isCallExpression(docArg) || ts.isIdentifier(docArg))) {
        const result = getDocumentReferenceFromDocumentNode(
          docArg,
          sourceFile.fileName,
          pluginInfo
        );
        foundNode = result.node;
        referencingNode = docArg;
      } else if (typeQuery && ts.isTypeQueryNode(typeQuery)) {
        const result = getDocumentReferenceFromTypeQuery(
          typeQuery,
          sourceFile.fileName,
          pluginInfo
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

      const fragmentDefs: FragmentDefinitionNode[] = [];
      const operation = foundNode.arguments[0].getText().slice(1, -1);
      if (foundNode.arguments[1] && ts.isArrayLiteralExpression(foundNode.arguments[1])) {
        unrollTadaFragments(
          foundNode.arguments[1],
          fragmentDefs,
          container.buildPluginInfo(params.pluginConfig)
        );
      }

      const seen = new Set<string>();
      let document: string;
      if (params.disableNormalization) {
        document = operation;
      } else {
        try {
          document = print(parse(operation));
        } catch (_error) {
          warnings.push({
            message:
              `The referenced document of "${referencingNode.getText()}" could not be parsed.\n` +
              'Run `check` to see specific validation errors.',
            file: position.fileName,
            line: position.line,
            col: position.col,
          });
          continue;
        }
      }

      // NOTE: Update graphqlsp not to pre-parse fragments, which also swallows errors
      for (const fragmentDef of fragmentDefs) {
        const printedFragmentDef = print(fragmentDef);
        if (!seen.has(printedFragmentDef)) {
          document += '\n\n' + print(fragmentDef);
          seen.add(printedFragmentDef);
        }
      }

      documents.push({
        schemaName: call.schema,
        hashKey: hashArg.getText().slice(1, -1),
        document,
      });
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
