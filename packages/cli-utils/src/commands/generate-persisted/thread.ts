import * as path from 'node:path';
import { print } from '@0no-co/graphql.web';
import { Project, ts } from 'ts-morph';

import type { FragmentDefinitionNode } from '@0no-co/graphql.web';
import type { GraphQLSPConfig } from '@gql.tada/internal';

import {
  init,
  findAllPersistedCallExpressions,
  getDocumentReferenceFromTypeQuery,
  getDocumentReferenceFromDocumentNode,
  unrollTadaFragments,
} from '@0no-co/graphqlsp/api';

import { createPluginInfo, getFilePosition } from '../../ts';
import { expose } from '../../threads';

import type { PersistedSignal, PersistedWarning } from './types';

export interface PersistedParams {
  rootPath: string;
  configPath: string;
  pluginConfig: GraphQLSPConfig;
}

async function* _runPersisted(params: PersistedParams): AsyncIterableIterator<PersistedSignal> {
  init({ typescript: ts as any });

  const projectPath = path.dirname(params.configPath);
  const project = new Project({ tsConfigFilePath: params.configPath });
  const pluginInfo = createPluginInfo(project, params.pluginConfig, projectPath);

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
    const documents: Record<string, string> = {};
    const warnings: PersistedWarning[] = [];

    const calls = findAllPersistedCallExpressions(sourceFile);
    for (const call of calls) {
      const position = getFilePosition(sourceFile, call.getStart());
      const hashArg = call.arguments[0];
      const docArg = call.arguments[1];
      const typeQuery = call.typeArguments && call.typeArguments[0];
      if (!hashArg || !ts.isStringLiteral(hashArg)) {
        warnings.push({
          message:
            '"graphql.persisted" must be called with a string literal as the first argument.',
          file: filePath,
          line: position.line,
          col: position.col,
        });
        continue;
      } else if (!docArg && !typeQuery) {
        warnings.push({
          message:
            '"graphql.persisted" is missing a document.\n' +
            'This may be passed as a generic such as `graphql.persisted<typeof document>` or as the second argument.',
          file: filePath,
          line: position.line,
          col: position.col,
        });
        continue;
      }

      let foundNode: ts.CallExpression | null = null;
      let referencingNode: ts.Node = call;
      if (docArg && (ts.isCallExpression(docArg) || ts.isIdentifier(docArg))) {
        const result = getDocumentReferenceFromDocumentNode(docArg, filePath, pluginInfo);
        foundNode = result.node;
        referencingNode = docArg;
      } else if (typeQuery && ts.isTypeQueryNode(typeQuery)) {
        const result = getDocumentReferenceFromTypeQuery(typeQuery, filePath, pluginInfo);
        foundNode = result.node;
        referencingNode = typeQuery;
      }

      if (!foundNode) {
        warnings.push({
          message:
            `Could not find reference for "${referencingNode.getText()}".\n` +
            'If this is unexpected, please file an issue describing your case.',
          file: filePath,
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
          file: filePath,
          line: position.line,
          col: position.col,
        });
        continue;
      }

      const fragments: FragmentDefinitionNode[] = [];
      const operation = foundNode.arguments[0].getText().slice(1, -1);
      if (foundNode.arguments[1] && ts.isArrayLiteralExpression(foundNode.arguments[1])) {
        unrollTadaFragments(foundNode.arguments[1], fragments, pluginInfo);
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
