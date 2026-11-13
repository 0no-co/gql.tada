import { createHash } from 'node:crypto';
import type { DocumentNode, GraphQLError, GraphQLSchema, IntrospectionQuery } from 'graphql';
import {
  Kind,
  parse,
  buildASTSchema,
  buildClientSchema,
  validate,
  validateSchema,
  specifiedRules,
  KnownFragmentNamesRule,
  LoneAnonymousOperationRule,
  NoFragmentCyclesRule,
  NoUnusedFragmentsRule,
  NoUnusedVariablesRule,
  UniqueFragmentNamesRule,
  UniqueOperationNamesRule,
} from 'graphql';
import {
  introspectSchema,
  minifyIntrospection,
  outputIntrospectionFile,
  parseIntrospectionJSON,
} from '@gql.tada/internal/introspection';

import type { MapperDiagnostic, TransformResult } from './protocol';

export const enum SchemaDiagnosticCode {
  SchemaError = 10,
  ValidationError = 11,
}

export interface SchemaTransformOptions {
  /** The `schemas[].name` of a multi-schema setup. Named schemas don't augment `setupSchema`. */
  name?: string;
  /** Whether the module declares itself as the default `setupSchema` introspection.
   * @defaultValue `true` when no `name` is given
   */
  augmentSetupSchema?: boolean;
}

/** A span in the transformed file, for errors that have no location of their own. */
interface Span {
  start: number;
  length: number;
}

interface BuiltSchema {
  schema: GraphQLSchema | null;
  diagnostics: MapperDiagnostic[];
}

export const hashContent = (content: string) => createHash('sha1').update(content).digest('hex');

// Keyed by content hash, since the mapper re-transforms on every edit and documents
// are validated against the same schema many times over
const schemaCache = new Map<string, BuiltSchema>();
const MAX_CACHED_SCHEMAS = 8;

const locate = (
  content: string,
  error: GraphQLError | Error
): { start: number; length: number } => {
  const graphQLError = error as GraphQLError;
  const node = graphQLError.nodes && graphQLError.nodes.find((node) => node.loc);
  if (node && node.loc) {
    // Name tokens are more precise than whole definitions
    const target =
      'name' in node && node.name && (node as any).name.loc ? (node as any).name : node;
    return { start: target.loc.start, length: target.loc.end - target.loc.start };
  } else if (graphQLError.positions && graphQLError.positions.length) {
    return { start: Math.min(graphQLError.positions[0], content.length), length: 0 };
  }
  // `buildASTSchema` joins SDL validation errors without locations, e.g. `Unknown type "Foo".`
  const quoted = /"([_A-Za-z][_0-9A-Za-z]*)"/.exec(error.message);
  if (quoted) {
    const match = new RegExp(`\\b${quoted[1]}\\b`).exec(content);
    if (match) return { start: match.index, length: quoted[1].length };
  }
  return { start: 0, length: 0 };
};

const toDiagnostics = (content: string, error: unknown, code: number): MapperDiagnostic[] => {
  const errors: (GraphQLError | Error)[] = Array.isArray(error) ? error : [error as Error];
  return errors.flatMap((error) =>
    // SDL validation reports all errors joined into one message
    `${error.message}`.split('\n\n').map((messageText) => ({
      messageText,
      ...locate(content, messageText === error.message ? error : new Error(messageText)),
      code,
    }))
  );
};

/** Builds and validates a schema from SDL, caching the result by content. */
export const buildSchemaFromSDL = (content: string): BuiltSchema => {
  const key = hashContent(content);
  let built = schemaCache.get(key);
  if (built) return built;
  try {
    const schema = buildASTSchema(parse(content));
    const errors = validateSchema(schema);
    built = errors.length
      ? {
          schema: null,
          diagnostics: toDiagnostics(content, errors, SchemaDiagnosticCode.SchemaError),
        }
      : { schema, diagnostics: [] };
  } catch (error) {
    built = {
      schema: null,
      diagnostics: toDiagnostics(content, error, SchemaDiagnosticCode.SchemaError),
    };
  }
  return cacheSchema(key, built);
};

const cacheSchema = (key: string, built: BuiltSchema) => {
  if (schemaCache.size >= MAX_CACHED_SCHEMAS) schemaCache.delete(schemaCache.keys().next().value!);
  schemaCache.set(key, built);
  return built;
};

interface ParsedIntrospection {
  introspection: IntrospectionQuery | null;
  error: string | null;
}

const introspectionCache = new Map<string, ParsedIntrospection>();

const parseIntrospection = (content: string): ParsedIntrospection => {
  const key = hashContent(content);
  let parsed = introspectionCache.get(key);
  if (!parsed) {
    try {
      parsed = { introspection: parseIntrospectionJSON(content), error: null };
    } catch (error: any) {
      parsed = { introspection: null, error: `${(error && error.message) || error}` };
    }
    if (introspectionCache.size >= MAX_CACHED_SCHEMAS)
      introspectionCache.delete(introspectionCache.keys().next().value!);
    introspectionCache.set(key, parsed);
  }
  return parsed;
};

/** Builds a schema from a JSON introspection result, caching the result by content. */
export const buildSchemaFromIntrospection = (content: string): BuiltSchema => {
  const key = `json:${hashContent(content)}`;
  const built = schemaCache.get(key);
  if (built) return built;
  const { introspection, error } = parseIntrospection(content);
  if (!introspection) {
    return cacheSchema(key, {
      schema: null,
      diagnostics: [
        { messageText: error!, start: 0, length: 0, code: SchemaDiagnosticCode.SchemaError },
      ],
    });
  }
  try {
    return cacheSchema(key, { schema: buildClientSchema(introspection), diagnostics: [] });
  } catch (error: any) {
    return cacheSchema(key, {
      schema: null,
      diagnostics: [
        {
          messageText: `${(error && error.message) || error}`,
          start: 0,
          length: 0,
          code: SchemaDiagnosticCode.SchemaError,
        },
      ],
    });
  }
};

/** Builds a schema from either schema format, caching the result by content. */
export const buildSchemaFromFile = (format: 'sdl' | 'json', content: string): BuiltSchema =>
  format === 'json' ? buildSchemaFromIntrospection(content) : buildSchemaFromSDL(content);

/** Whether an SDL document defines a whole schema, rather than e.g. only client-side extensions. */
export const isSchemaDocument = (content: string): boolean => {
  let document: DocumentNode;
  try {
    document = parse(content, { noLocation: true });
  } catch {
    return false;
  }
  let hasRootType = false;
  for (const definition of document.definitions) {
    if (
      definition.kind === Kind.OPERATION_DEFINITION ||
      definition.kind === Kind.FRAGMENT_DEFINITION
    ) {
      return false;
    } else if (definition.kind === Kind.SCHEMA_DEFINITION) {
      hasRootType = true;
    } else if (
      definition.kind === Kind.OBJECT_TYPE_DEFINITION &&
      definition.name.value === 'Query'
    ) {
      hasRootType = true;
    }
  }
  return hasRootType;
};

const IMPORT_LINE = "import * as gqlTada from 'gql.tada';\n";

/** Transforms an SDL schema into the module `gql.tada generate output` would write for it.
 *
 * @remarks
 * The type declarations come from `@gql.tada/internal`'s `.d.ts` output, so they're identical
 * to a generated `tadaOutputLocation` file. Only its unused `gqlTada` namespace import is
 * dropped, since the virtual module is a `.ts` file and would otherwise trip `noUnusedLocals`.
 */
export const transformSchema = (
  content: string,
  options: SchemaTransformOptions = {}
): TransformResult => {
  const { schema, diagnostics } = buildSchemaFromSDL(content);
  if (!schema) {
    return { text: 'export {};\n', extension: '.ts', mappings: [], diagnostics };
  }
  const result = introspectSchema(schema);
  if (result.errors || !result.data) {
    return {
      text: 'export {};\n',
      extension: '.ts',
      mappings: [],
      diagnostics: toDiagnostics(content, result.errors || [], SchemaDiagnosticCode.SchemaError),
    };
  }
  return emitIntrospection(result.data as unknown as IntrospectionQuery, options);
};

const emitIntrospection = (
  introspection: IntrospectionQuery,
  options: SchemaTransformOptions
): TransformResult => {
  const augment = options.augmentSetupSchema != null ? options.augmentSetupSchema : !options.name;
  const text = outputIntrospectionFile(
    minifyIntrospection({
      ...introspection,
      // `outputIntrospectionFile` omits the `setupSchema` augmentation for named schemas
      name: augment ? undefined : options.name || 'schema',
    }),
    { fileType: '.d.ts', shouldPreprocess: true }
  ).replace(IMPORT_LINE, '');
  return { text, extension: '.ts', mappings: [], diagnostics: [] };
};

/** Transforms a JSON introspection result into the module `gql.tada generate output` would write for it.
 *
 * @remarks
 * TypeScript doesn't let content mappers register `.json` files, so this is the module of a
 * `.graphql` file that imports the JSON schema (`# import * from "./schema.json"`). Errors are
 * reported on that import, since the JSON file isn't the file being transformed.
 */
export const transformIntrospection = (
  json: string,
  options: SchemaTransformOptions & { fileName: string; span: Span }
): TransformResult => {
  const { introspection, error } = parseIntrospection(json);
  if (!introspection) {
    return {
      text: 'export {};\n',
      extension: '.ts',
      mappings: [],
      diagnostics: [
        {
          messageText: `${options.fileName}: ${error}`,
          ...options.span,
          code: SchemaDiagnosticCode.SchemaError,
        },
      ],
    };
  }
  return emitIntrospection(introspection, options);
};

// Rules that the document transform already reports, or that misfire because
// `.graphql` files export fragments and import others from different files
const DOCUMENT_RULES = specifiedRules.filter(
  (rule) =>
    rule !== KnownFragmentNamesRule &&
    rule !== NoUnusedFragmentsRule &&
    rule !== LoneAnonymousOperationRule &&
    rule !== NoFragmentCyclesRule &&
    rule !== UniqueFragmentNamesRule &&
    rule !== UniqueOperationNamesRule
);

/** Validates a `.graphql` document against a schema, in original-source coordinates. */
export const validateDocument = (content: string, schema: GraphQLSchema): MapperDiagnostic[] => {
  let document: DocumentNode;
  try {
    document = parse(content);
  } catch {
    // Syntax errors are reported by the document transform
    return [];
  }
  const localFragments = new Set<string>();
  for (const definition of document.definitions)
    if (definition.kind === Kind.FRAGMENT_DEFINITION) localFragments.add(definition.name.value);
  // Variables may only be used in fragments that are imported from other files
  let hasImportedSpreads = false;
  const findSpreads = (node: any): void => {
    if (!node || typeof node !== 'object' || hasImportedSpreads) return;
    if (node.kind === Kind.FRAGMENT_SPREAD && !localFragments.has(node.name.value)) {
      hasImportedSpreads = true;
    } else {
      for (const key in node) if (key !== 'loc') findSpreads(node[key]);
    }
  };
  findSpreads(document.definitions);
  const rules = hasImportedSpreads
    ? DOCUMENT_RULES.filter((rule) => rule !== NoUnusedVariablesRule)
    : DOCUMENT_RULES;
  return toDiagnostics(
    content,
    validate(schema, document, rules),
    SchemaDiagnosticCode.ValidationError
  );
};
