import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type {
  DocumentNode,
  GraphQLInputObjectType,
  GraphQLNamedType,
  GraphQLSchema,
  IntrospectionQuery,
} from 'graphql';
import {
  TypeInfo,
  buildASTSchema,
  buildClientSchema,
  getNamedType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
  parse,
  print,
  visit,
  visitWithTypeInfo,
} from 'graphql';

/** Either a fixed fingerprint for every document, or one computed per document. */
export type SchemaFingerprint = string | ((documentText: string) => string);

const FINGERPRINT_VERSION = 'reachable-v1';

/**
 * Creates a per-document schema fingerprint for one configured schema.
 *
 * Only the parts of the schema that can affect a document's result or
 * variables type are hashed, so a schema change only invalidates the
 * documents it can affect. Fragments from other documents aren't described
 * here, since their own hashes are already part of the document hash.
 *
 * Falls back to `fallback` (the whole-output fingerprint) when the schema
 * isn't a local SDL or introspection JSON file, or when the schema or
 * document can't be parsed.
 */
export function createSchemaFingerprinter(
  schemaOption: unknown,
  configDir: string,
  fallback: string
): SchemaFingerprint {
  const schemaPath = resolveLocalSchemaPath(schemaOption, configDir);
  if (!schemaPath) return fallback;

  // undefined: not loaded yet; null: unavailable, so use the fallback
  let schema: GraphQLSchema | null | undefined;
  const memo = new Map<string, string>();

  return (documentText) => {
    if (schema === undefined) schema = loadSchema(schemaPath);
    if (!schema) return fallback;

    let fingerprint = memo.get(documentText);
    if (fingerprint) return fingerprint;
    try {
      const description = describeDocument(schema, parse(documentText, { noLocation: true }));
      const hash = crypto.createHash('sha256').update(description).digest('hex');
      fingerprint = `${FINGERPRINT_VERSION}:sha256:${hash.slice(0, 32)}`;
    } catch {
      fingerprint = fallback;
    }
    memo.set(documentText, fingerprint);
    return fingerprint;
  };
}

function resolveLocalSchemaPath(schemaOption: unknown, configDir: string): string | undefined {
  if (typeof schemaOption !== 'string' || /^https?:\/\//.test(schemaOption)) return undefined;
  if (!/\.(graphql|gql|json)$/.test(schemaOption)) return undefined;
  return path.resolve(configDir, schemaOption);
}

function loadSchema(schemaPath: string): GraphQLSchema | null {
  try {
    const contents = fs.readFileSync(schemaPath, 'utf8');
    if (schemaPath.endsWith('.json')) {
      const json = JSON.parse(contents);
      const introspection: IntrospectionQuery = json.data || json;
      return buildClientSchema(introspection, { assumeValid: true });
    }
    return buildASTSchema(parse(contents, { noLocation: true }), {
      assumeValid: true,
      assumeValidSDL: true,
    });
  } catch {
    return null;
  }
}

const sortedNames = (types: readonly { name: string }[]): string =>
  types
    .map((type) => type.name)
    .sort()
    .join(',');

/** Describes every schema element that can influence `document`'s generated types. */
export function describeDocument(schema: GraphQLSchema, document: DocumentNode): string {
  const parts = new Set<string>();
  const describedInputs = new Set<string>();

  const describeNamed = (type: GraphQLNamedType | null | undefined): void => {
    if (!type) return;
    if (isEnumType(type)) {
      const values = type
        .getValues()
        .map((value) => value.name)
        .sort();
      parts.add(`enum:${type.name}:${values.join(',')}`);
    } else if (isScalarType(type)) {
      parts.add(`scalar:${type.name}`);
    } else if (isObjectType(type)) {
      parts.add(`object:${type.name}:${sortedNames(type.getInterfaces())}`);
    } else if (isInterfaceType(type)) {
      const interfaces = sortedNames(type.getInterfaces());
      const possibleTypes = sortedNames(schema.getPossibleTypes(type));
      parts.add(`interface:${type.name}:${interfaces}:${possibleTypes}`);
    } else if (isUnionType(type)) {
      parts.add(`union:${type.name}:${sortedNames(schema.getPossibleTypes(type))}`);
    } else if (isInputObjectType(type)) {
      describeInput(type);
    }
  };

  // Variables are typed from the full input type, so input objects are
  // described in full, recursively.
  const describeInput = (type: GraphQLInputObjectType): void => {
    if (describedInputs.has(type.name)) return;
    describedInputs.add(type.name);
    const isOneOf = (type as { isOneOf?: boolean }).isOneOf === true;
    parts.add(`input:${type.name}:${isOneOf ? 'oneOf' : ''}`);
    for (const field of Object.values(type.getFields())) {
      const hasDefault = field.defaultValue !== undefined;
      parts.add(
        `inputField:${type.name}.${field.name}:${String(field.type)}:${hasDefault ? 'default' : ''}`
      );
      describeNamed(getNamedType(field.type));
    }
  };

  const typeInfo = new TypeInfo(schema);
  visit(
    document,
    visitWithTypeInfo(typeInfo, {
      OperationDefinition(node) {
        const root = typeInfo.getType();
        parts.add(`root:${node.operation}:${root ? getNamedType(root).name : '?missing'}`);
        describeNamed(root && getNamedType(root));
      },
      VariableDefinition(node) {
        const type = typeInfo.getInputType();
        if (!type) {
          parts.add(`missingVariableType:${print(node.type)}`);
          return;
        }
        describeNamed(getNamedType(type));
      },
      InlineFragment(node) {
        if (!node.typeCondition) return;
        const type = typeInfo.getType();
        if (!type) {
          parts.add(`missingType:${node.typeCondition.name.value}`);
          return;
        }
        describeNamed(getNamedType(type));
      },
      FragmentDefinition(node) {
        const type = typeInfo.getType();
        if (!type) {
          parts.add(`missingType:${node.typeCondition.name.value}`);
          return;
        }
        describeNamed(getNamedType(type));
      },
      Field(node) {
        const parent = typeInfo.getParentType();
        const field = typeInfo.getFieldDef();
        if (!parent || !field) {
          parts.add(`missingField:${parent ? parent.name : '?'}.${node.name.value}`);
          return;
        }
        // The parent's description covers `__typename` and fragment
        // applicability (possible types and interfaces)
        describeNamed(parent);
        parts.add(`field:${parent.name}.${field.name}:${String(field.type)}`);
        describeNamed(getNamedType(field.type));
      },
    })
  );

  return Array.from(parts).sort().join('\n');
}
