import ts from 'typescript';
import * as path from 'node:path';

import type { GraphQLSPConfig } from '@gql.tada/internal';
import { load } from '@gql.tada/internal';
import { getGraphQLDiagnostics } from '@0no-co/graphqlsp/api';

import { programFactory } from '../../ts';
import { expose } from '../../threads';

import type { Severity, DiagnosticMessage, DiagnosticSignal } from './types';

export interface DiagnosticsParams {
  rootPath: string;
  configPath: string;
  pluginConfig: GraphQLSPConfig;
}

async function* _runDiagnostics(
  params: DiagnosticsParams
): AsyncIterableIterator<DiagnosticSignal> {
  if (!('schema' in params.pluginConfig)) {
    // TODO: Implement multi-schema support
    throw new Error('Multi-schema support is not implemented yet');
  }

  const projectPath = path.dirname(params.configPath);
  const loader = load({ origin: params.pluginConfig.schema, rootPath: projectPath });
  const factory = programFactory(params);

  const externalFiles = factory.createExternalFiles();
  if (externalFiles.length) {
    yield { kind: 'EXTERNAL_WARNING' };
    await factory.addVirtualFiles(externalFiles);
  }

  const container = factory.build();
  const pluginInfo = container.buildPluginInfo(params.pluginConfig);
  const loadResult = await loader.load();
  const schemaRef = { current: loadResult.schema, version: 1 };
  const sourceFiles = container.getSourceFiles();

  yield {
    kind: 'FILE_COUNT',
    fileCount: sourceFiles.length,
  };

  for (const sourceFile of sourceFiles) {
    let filePath = sourceFile.fileName;
    const diagnostics = getGraphQLDiagnostics(filePath, schemaRef as any, pluginInfo);
    const messages: DiagnosticMessage[] = [];

    if (diagnostics && diagnostics.length) {
      for (const diagnostic of diagnostics) {
        if (
          !('messageText' in diagnostic) ||
          typeof diagnostic.messageText !== 'string' ||
          !diagnostic.file
        ) {
          continue;
        }
        let severity: Severity = 'info';
        if (diagnostic.category === ts.DiagnosticCategory.Error) {
          severity = 'error';
        } else if (diagnostic.category === ts.DiagnosticCategory.Warning) {
          severity = 'warn';
        }
        const span = { start: diagnostic.start || 1, length: diagnostic.length || 1 };
        const position = container.getSourcePosition(sourceFile, span);
        filePath = position.fileName;
        messages.push({
          severity,
          message: diagnostic.messageText,
          file: position.fileName,
          line: position.line,
          col: position.col,
          endLine: position.endLine,
          endColumn: position.endColumn,
        });
      }
    }

    yield {
      kind: 'FILE_DIAGNOSTICS',
      filePath,
      messages,
    };
  }
}

export const runDiagnostics = expose(_runDiagnostics);
