import * as path from 'node:path';
import { print } from '@0no-co/graphql.web';
import { Project, ts } from 'ts-morph';

import type { FragmentDefinitionNode } from '@0no-co/graphql.web';
import type { GraphQLSPConfig } from '@gql.tada/internal';

import {
  init,
  findAllPersistedCallExpressions,
  getDocumentReferenceFromTypeQuery,
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
      const hash = call.arguments[0];
      if (!ts.isStringLiteral(hash)) {
        warnings.push({
          message:
            '"graphql.persisted" must be called with a string literal as the first argument.',
          file: filePath,
          line: position.line,
          col: position.col,
        });
        continue;
      } else if (!call.typeArguments || !ts.isTypeQueryNode(call.typeArguments[0])) {
        warnings.push({
          message:
            '"graphql.persisted" is missing a generic such as `graphql.persisted<typeof document>`.',
          file: filePath,
          line: position.line,
          col: position.col,
        });
        continue;
      }

      const typeQuery = call.typeArguments[0];
      const { node: foundNode } = getDocumentReferenceFromTypeQuery(
        typeQuery,
        filePath,
        pluginInfo
      );
      if (!foundNode) {
        warnings.push({
          message:
            `Could not find reference for "${typeQuery.getText()}".\n` +
            'If this is unexpected, please file an issue describing your case.',
          file: filePath,
          line: position.line,
          col: position.col,
        });
        continue;
      }

      const { initializer } = foundNode;
      if (
        !initializer ||
        !ts.isCallExpression(initializer) ||
        (!ts.isNoSubstitutionTemplateLiteral(initializer.arguments[0]) &&
          !ts.isStringLiteral(initializer.arguments[0]))
      ) {
        warnings.push({
          message:
            `The referenced document of "${typeQuery.getText()}" contains no document string literal.\n` +
            'If this is unexpected, please file an issue describing your case.',
          file: filePath,
          line: position.line,
          col: position.col,
        });
        continue;
      }

      const fragments: FragmentDefinitionNode[] = [];
      const operation = initializer.arguments[0].getText().slice(1, -1);
      if (initializer.arguments[1] && ts.isArrayLiteralExpression(initializer.arguments[1])) {
        unrollTadaFragments(initializer.arguments[1], fragments, pluginInfo);
      }

      let document = operation;
      for (const fragment of fragments) document += '\n\n' + print(fragment);
      documents[JSON.parse(hash.getFullText())] = document;
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
