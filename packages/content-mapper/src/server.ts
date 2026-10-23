import * as fs from 'node:fs';
import * as path from 'node:path';
import { createMessageConnection, ErrorCodes, ResponseError } from 'vscode-jsonrpc/node';

import { transform, resolveGraphQLModule } from './transform';
import { readProjectConfig } from './config';
import type { SchemaEntry } from './config';
import {
  buildSchemaFromSDL,
  hashContent,
  isSchemaDocument,
  transformSchema,
  validateDocument,
} from './schema';
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
  schemas: SchemaEntry[];
  /** The schema documents are validated against, i.e. the only configured schema. */
  validationSchema: { file: string; content: string } | null;
}

const projects = new Map<string, Project>();

const normalizePath = (fileName: string) =>
  process.platform === 'win32' || process.platform === 'darwin'
    ? path.normalize(fileName).toLowerCase()
    : path.normalize(fileName);

const readFile = (fileName: string): string | null => {
  try {
    return fs.readFileSync(fileName, 'utf8');
  } catch {
    return null;
  }
};

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

  // The plugin config isn't passed to mappers (TypeScript 7 strips plugin options), so it's
  // read here and declared as dynamic config: the host reopens this project when any of the
  // watched files change, and re-transforms its files when the identity below changes
  const { schemas, configFiles } = readProjectConfig(params.configFileName);
  const identity: string[] = [JSON.stringify(schemas)];
  let validationSchema: Project['validationSchema'] = null;
  if (schemas.length === 1) {
    const content = readFile(schemas[0].file);
    if (content != null) {
      validationSchema = { file: schemas[0].file, content };
      // Documents are validated against the schema on disk, so its content is part of the identity
      identity.push(hashContent(content));
    }
  }

  projects.set(params.projectHandle, {
    configFileName: params.configFileName,
    graphqlModule: typeof options.module === 'string' ? options.module : 'gql.tada',
    graphqlExport: typeof options.export === 'string' ? options.export : 'graphql',
    schemas,
    validationSchema,
  });

  return {
    configIdentity: hashContent(identity.join('\0')),
    watchedFiles: [...configFiles, ...schemas.map((schema) => schema.file)],
    ...(optionDiagnostics.length ? { optionDiagnostics } : {}),
  };
});

connection.onRequest('closeProject', (params: CloseProjectParams) => {
  projects.delete(params.projectHandle);
  return null;
});

connection.onRequest('transform', (params: TransformParams): TransformResult => {
  const project = projects.get(params.projectHandle);
  if (!project)
    throw new ResponseError(ErrorCodes.InvalidParams, `Unknown project: ${params.projectHandle}`);

  const fileKey = normalizePath(params.fileName);
  const schemaEntry = project.schemas.find((schema) => normalizePath(schema.file) === fileKey);
  if (schemaEntry) {
    return transformSchema(params.content, { name: schemaEntry.name });
  } else if (!project.schemas.length && isSchemaDocument(params.content)) {
    // Without a plugin config, schema files only export their `introspection` type,
    // since several of them would otherwise conflict over `setupSchema`
    return transformSchema(params.content, { augmentSetupSchema: false });
  }

  const result = transform(params.content, {
    fileName: params.fileName,
    graphqlModule: resolveGraphQLModule(
      project.configFileName,
      params.fileName,
      project.graphqlModule
    ),
    graphqlExport: project.graphqlExport,
  });

  if (project.validationSchema && !(result.diagnostics && result.diagnostics.length)) {
    const { schema } = buildSchemaFromSDL(project.validationSchema.content);
    if (schema) result.diagnostics = validateDocument(params.content, schema);
  }
  return result;
});

connection.listen();
