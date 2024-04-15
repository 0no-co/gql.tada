import * as path from 'node:path';
import { Project, ts } from 'ts-morph';

import type { GraphQLSPConfig } from '@gql.tada/internal';
import { load } from '@gql.tada/internal';
import { init, getGraphQLDiagnostics } from '@0no-co/graphqlsp/api';

import { createPluginInfo, getFilePosition } from '../../ts';
import { expose } from '../../threads';

import type { Severity, DiagnosticMessage, DiagnosticSignal } from './types';

const loadSchema = async (rootPath: string, config: GraphQLSPConfig) => {
  const loader = load({ origin: config.schema, rootPath });
  const result = await loader.load();
  if (!result) throw new Error('Failed to load schema');
  return { current: result.schema, version: 1 };
};

export interface DiagnosticsParams {
  rootPath: string;
  configPath: string;
  pluginConfig: GraphQLSPConfig;
}

async function* _runDiagnostics(
  params: DiagnosticsParams
): AsyncIterableIterator<DiagnosticSignal> {
  init({ typescript: ts as any });
  const projectPath = path.dirname(params.configPath);
  const schemaRef = await loadSchema(projectPath, params.pluginConfig);
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
    const diagnostics = getGraphQLDiagnostics(filePath, schemaRef, pluginInfo);
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
        const position = getFilePosition(sourceFile, diagnostic.start, diagnostic.length);
        messages.push({
          severity,
          message: diagnostic.messageText,
          file: diagnostic.file.fileName,
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
