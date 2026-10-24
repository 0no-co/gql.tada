import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GraphQLSchema } from 'graphql';
import { createMessageConnection, ErrorCodes, ResponseError } from 'vscode-jsonrpc/node';

import { transform, resolveGraphQLModule, scanImports } from './transform';
import { readProjectConfig } from './config';
import type { SchemaEntry } from './config';
import {
  buildSchemaFromFile,
  hashContent,
  isSchemaDocument,
  SchemaDiagnosticCode,
  transformIntrospection,
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
  MapperDiagnostic,
  TransformParams,
  TransformResult,
} from './protocol';

interface Project {
  configFileName: string;
  graphqlModule: string;
  graphqlExport: string;
  intellisense: boolean;
  schemas: SchemaEntry[];
  /** Contents of JSON schemas on disk, keyed by normalized path */
  jsonSchemas: Map<string, { entry: SchemaEntry; content: string | null }>;
  /** The schema documents are validated against, i.e. the only configured schema. */
  validationSchema: {
    format: SchemaEntry['format'];
    content: string;
    /** Built on the first validation. Projects are reopened when the schema file changes */
    schema?: GraphQLSchema | null;
  } | null;
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
  if (options.intellisense != null && typeof options.intellisense !== 'boolean') {
    optionDiagnostics.push({
      path: ['intellisense'],
      messageText: 'The `intellisense` option must be a boolean.',
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
  const jsonSchemas: Project['jsonSchemas'] = new Map();
  let validationSchema: Project['validationSchema'] = null;
  for (const entry of schemas) {
    // JSON schemas and the schema documents are validated against are read from disk,
    // rather than passed to `transform`, so their contents are part of the identity
    if (entry.format !== 'json' && schemas.length > 1) continue;
    const content = readFile(entry.file);
    identity.push(content != null ? hashContent(content) : '');
    if (entry.format === 'json') jsonSchemas.set(normalizePath(entry.file), { entry, content });
    if (schemas.length === 1 && content != null)
      validationSchema = { format: entry.format, content };
  }

  projects.set(params.projectHandle, {
    configFileName: params.configFileName,
    graphqlModule: typeof options.module === 'string' ? options.module : 'gql.tada',
    graphqlExport: typeof options.export === 'string' ? options.export : 'graphql',
    intellisense: options.intellisense === true,
    schemas,
    jsonSchemas,
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
  const schemaEntry = project.schemas.find(
    (schema) => schema.format === 'sdl' && normalizePath(schema.file) === fileKey
  );
  if (schemaEntry) {
    return transformSchema(params.content, { name: schemaEntry.name });
  } else if (!project.schemas.length && isSchemaDocument(params.content)) {
    // Without a plugin config, schema files only export their `introspection` type,
    // since several of them would otherwise conflict over `setupSchema`
    return transformSchema(params.content, { augmentSetupSchema: false });
  }

  // TypeScript doesn't let content mappers register `.json` files, so a JSON schema is
  // mapped through a `.graphql` file that only imports it, e.g. `# import * from "./schema.json"`
  const { imports, hasDefinitions } = scanImports(params.content);
  const diagnostics: MapperDiagnostic[] = [];
  for (const documentImport of imports) {
    if (path.extname(documentImport.path) !== '.json') continue;
    const jsonFile = path.resolve(path.dirname(params.fileName), documentImport.path);
    const jsonSchema = project.jsonSchemas.get(normalizePath(jsonFile));
    const span = { start: documentImport.start, length: documentImport.length };
    if (!jsonSchema) {
      diagnostics.push({
        messageText:
          'Only JSON introspection files configured as a `schema` in your GraphQLSP / gql.tada plugin config can be imported.',
        ...span,
        code: SchemaDiagnosticCode.SchemaError,
      });
    } else if (hasDefinitions || imports.length > 1) {
      diagnostics.push({
        messageText:
          'A JSON schema can only be imported by a file that contains nothing but this import.',
        ...span,
        code: SchemaDiagnosticCode.SchemaError,
      });
    } else if (jsonSchema.content == null) {
      diagnostics.push({
        messageText: `Cannot read the JSON schema at "${documentImport.path}".`,
        ...span,
        code: SchemaDiagnosticCode.SchemaError,
      });
    } else {
      return transformIntrospection(jsonSchema.content, {
        name: jsonSchema.entry.name,
        fileName: documentImport.path,
        span,
      });
    }
  }
  if (diagnostics.length && !hasDefinitions) {
    return { text: 'export {};\n', extension: '.ts', mappings: [], diagnostics };
  }

  const result = transform(params.content, {
    fileName: params.fileName,
    graphqlModule: resolveGraphQLModule(
      project.configFileName,
      params.fileName,
      project.graphqlModule
    ),
    graphqlExport: project.graphqlExport,
    intellisense: project.intellisense,
    // Validation reports unknown fields and types with GraphQL's own messages
    ignoreIntellisenseErrors: !!project.validationSchema,
  });

  const { validationSchema } = project;
  if (validationSchema && !(result.diagnostics && result.diagnostics.length)) {
    // NOTE: The schema cache is keyed by a hash of the schema's content, which costs more
    // than validating a document against large schemas, so the project keeps its own reference
    if (validationSchema.schema === undefined) {
      validationSchema.schema = buildSchemaFromFile(
        validationSchema.format,
        validationSchema.content
      ).schema;
    }
    if (validationSchema.schema)
      result.diagnostics = validateDocument(params.content, validationSchema.schema);
  }
  if (diagnostics.length) result.diagnostics = [...diagnostics, ...(result.diagnostics || [])];
  return result;
});

connection.listen();
