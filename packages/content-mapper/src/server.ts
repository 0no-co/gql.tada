import { createMessageConnection, ErrorCodes, ResponseError } from 'vscode-jsonrpc/node';

import { transform, resolveGraphQLModule } from './transform';
import type {
  CloseProjectParams,
  InitializeParams,
  InitializeResult,
  OpenProjectParams,
  OpenProjectResult,
  OptionDiagnostic,
  TransformParams,
  TransformResult,
} from './protocol';

interface Project {
  configFileName: string;
  graphqlModule: string;
  graphqlExport: string;
}

const projects = new Map<string, Project>();

const connection = createMessageConnection(process.stdin, process.stdout);

connection.onRequest('initialize', (params: InitializeParams): InitializeResult => {
  if (!params.positionEncodings.includes('utf-16'))
    throw new ResponseError(ErrorCodes.InvalidParams, 'The host does not support UTF-16 positions');
  return { protocolVersion: 1, positionEncoding: 'utf-16', diagnosticSource: 'gql.tada' };
});

connection.onRequest('openProject', (params: OpenProjectParams): OpenProjectResult => {
  const options = params.options || {};
  const optionDiagnostics: OptionDiagnostic[] = [];
  if (typeof options.module !== 'string' || !options.module) {
    optionDiagnostics.push({
      path: ['module'],
      messageText:
        'Specify the module that exports your `graphql()` function, e.g. "./src/graphql.ts".',
      code: 1,
    });
  }
  if (options.export != null && typeof options.export !== 'string') {
    optionDiagnostics.push({
      path: ['export'],
      messageText: 'The `export` option must be the name of your `graphql()` function export.',
      code: 1,
    });
  }
  projects.set(params.projectHandle, {
    configFileName: params.configFileName,
    graphqlModule: typeof options.module === 'string' ? options.module : 'gql.tada',
    graphqlExport: typeof options.export === 'string' ? options.export : 'graphql',
  });
  return optionDiagnostics.length ? { optionDiagnostics } : {};
});

connection.onRequest('closeProject', (params: CloseProjectParams) => {
  projects.delete(params.projectHandle);
  return null;
});

connection.onRequest('transform', (params: TransformParams): TransformResult => {
  const project = projects.get(params.projectHandle);
  if (!project)
    throw new ResponseError(ErrorCodes.InvalidParams, `Unknown project: ${params.projectHandle}`);
  return transform(params.content, {
    fileName: params.fileName,
    graphqlModule: resolveGraphQLModule(
      project.configFileName,
      params.fileName,
      project.graphqlModule
    ),
    graphqlExport: project.graphqlExport,
  });
});

connection.listen();
