import * as path from 'node:path';
import { Project, ts } from 'ts-morph';

import { load, resolveTypeScriptRootDir } from '@gql.tada/internal';
import { init, getGraphQLDiagnostics } from '@0no-co/graphqlsp/api';

import type { GraphQLSPConfig } from '../../lsp';
import { createPluginInfo } from '../../ts/project';
import { expose } from '../../threads';

import type { Severity, DiagnosticMessage, DiagnosticSignal } from './types';

const getLineCol = (text: string, start: number | undefined): [number, number] => {
  if (text && start) {
    let counter = 0;
    const parts = text.split('\n');
    for (let i = 0; i <= parts.length; i++) {
      const line = parts[i];
      if (counter + line.length > start) {
        return [i + 1, start + 1 - counter];
      } else {
        counter = counter + (line.length + 1);
        continue;
      }
    }
  }
  return [0, 0];
};

const loadSchema = async (rootPath: string, config: GraphQLSPConfig) => {
  const loader = load({ origin: config.schema, rootPath });
  const result = await loader.load();
  if (!result) throw new Error('Failed to load schema');
  return { current: result.schema, version: 1 };
};

export interface DiagnosticsParams {
  config: GraphQLSPConfig;
  tsconfigPath: string;
}

async function* _runDiagnostics(
  params: DiagnosticsParams
): AsyncIterableIterator<DiagnosticSignal> {
  init({ typescript: ts as any });
  const projectPath = path.dirname(params.tsconfigPath);
  const rootPath = (await resolveTypeScriptRootDir(params.tsconfigPath)) || params.tsconfigPath;
  const schemaRef = await loadSchema(rootPath, params.config);
  const project = new Project({ tsConfigFilePath: params.tsconfigPath });
  const pluginInfo = createPluginInfo(project, params.config, projectPath);
  const sourceFiles = project.getSourceFiles();

  yield {
    kind: 'FILE_COUNT',
    fileCount: sourceFiles.length,
  };

  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath();
    const diagnostics = getGraphQLDiagnostics(filePath, schemaRef, pluginInfo);
    const messages: DiagnosticMessage[] = [];

    if (diagnostics && diagnostics.length) {
      const sourceText = sourceFile.getText();
      for (const diagnostic of diagnostics) {
        if (
          !('messageText' in diagnostic) ||
          typeof diagnostic.messageText !== 'string' ||
          !diagnostic.file
        )
          continue;
        let severity: Severity = 'info';
        if (diagnostic.category === ts.DiagnosticCategory.Error) {
          severity = 'error';
        } else if (diagnostic.category === ts.DiagnosticCategory.Warning) {
          severity = 'warn';
        }
        const [line, col] = getLineCol(sourceText, diagnostic.start);
        messages.push({
          severity,
          message: diagnostic.messageText,
          file: diagnostic.file.fileName,
          line,
          col,
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
