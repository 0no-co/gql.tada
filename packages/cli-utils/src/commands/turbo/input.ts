import ts from 'typescript';
import * as crypto from 'node:crypto';
import { Kind, parse } from 'graphql';
import type { TypeNode } from 'graphql';

import { INPUT_ALIAS_PREFIX } from './types';

interface SerializedDocumentType {
  documentType: string;
  inputTypes?: Record<string, string>;
}

const must = <T>(value: T | undefined): T => {
  if (value === undefined) throw new TypeError('Unexpected introspection type shape');
  return value;
};

/** Serialize input objects separately so recursive references have a name.
 * @remarks
 * This mirrors the variable types in gql.tada's `src/variables.ts` and must be kept in sync with it.
 */
export function serializeDocumentType(
  checker: ts.TypeChecker,
  call: ts.CallExpression,
  document: string,
  returnType: ts.Type,
  flags: ts.TypeFormatFlags
): SerializedDocumentType {
  const print = (type: ts.Type) => checker.typeToString(type, call, flags);
  try {
    const serialized = serializeInputTypes(checker, call, document, returnType, print);
    if (serialized) return serialized;
  } catch {
    // NOTE: An unexpected schema shape falls back to the printed type rather than failing turbo
  }
  return { documentType: print(returnType) };
}

function serializeInputTypes(
  checker: ts.TypeChecker,
  call: ts.CallExpression,
  document: string,
  returnType: ts.Type,
  print: (type: ts.Type) => string
): SerializedDocumentType | undefined {
  const api = checker.getTypeAtLocation(call.expression);
  if (!api.symbol || api.symbol.getName() !== 'GraphQLTadaAPI') return;
  const schema = checker.getTypeArguments(api as ts.TypeReference)[0];
  const property = (type: ts.Type, name: string): ts.Type | undefined => {
    const symbol = checker.getPropertyOfType(type, name);
    return symbol && checker.getTypeOfSymbolAtLocation(symbol, call);
  };
  const types = schema && property(schema, 'types');
  if (!types) return;
  const literal = (type: ts.Type | undefined): string | undefined =>
    type && type.isStringLiteral() ? type.value : undefined;
  const kind = (type: ts.Type) => literal(property(type, 'kind'));
  const input = (name: string): ts.Type | undefined => {
    const type = property(types, name);
    return type && kind(type) === 'INPUT_OBJECT' ? type : undefined;
  };

  // NOTE: Like getVariablesType, only the first definition's variables are used
  const definition = parse(document).definitions[0];
  if (!definition || definition.kind !== Kind.OPERATION_DEFINITION) return;
  const arguments_ = checker.getTypeArguments(returnType as ts.TypeReference);
  const variables = arguments_[1];
  const inputTypes: Record<string, string> = {};

  const nameInput = (rootName: string): string => {
    const bodies = new Map<string, string>();
    const renderNamed = (name: string, reference: (name: string) => string): string => {
      if (input(name)) return reference(name);
      const type = property(types, name);
      const value = type && (property(type, 'type') || property(type, 'enumValues'));
      return value ? print(value) : type ? 'unknown' : 'never';
    };
    const renderRef = (
      ref: ts.Type,
      optional: boolean,
      reference: (name: string) => string
    ): string => {
      const refKind = kind(ref);
      if (refKind === 'NON_NULL') return renderRef(must(property(ref, 'ofType')), false, reference);
      const value =
        refKind === 'LIST'
          ? `(${renderRef(must(property(ref, 'ofType')), true, reference)})[]`
          : renderNamed(must(literal(property(ref, 'name'))), reference);
      return optional ? `(${value}) | null` : value;
    };
    const renderInput = (name: string, reference: (name: string) => string): string => {
      const type = must(input(name));
      const fields = checker.getTypeArguments(
        must(property(type, 'inputFields')) as ts.TypeReference
      );
      // NOTE: Output from before oneOf support omits `isOneOf`, which core treats as `false`
      const oneOf = property(type, 'isOneOf');
      const isOneOf = !!oneOf && print(oneOf) === 'true';
      const members = fields.map((field) => {
        const fieldName = JSON.stringify(must(literal(property(field, 'name'))));
        const ref = must(property(field, 'type'));
        if (isOneOf) return `{ ${fieldName}: ${renderRef(ref, false, reference)}; }`;
        const defaultValue = property(field, 'defaultValue');
        const noDefault =
          !defaultValue || !!(defaultValue.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined));
        const required = kind(ref) === 'NON_NULL' && noDefault;
        // Optional input fields include null even when their type is non-null
        // and a default made the field optional (see getInputObjectTypeRec).
        const value = renderRef(ref, false, reference);
        return `${fieldName}${required ? '' : '?'}: ${required ? value : `(${value}) | null`};`;
      });
      return isOneOf ? members.join(' | ') || 'never' : `{ ${members.join(' ')} }`;
    };
    const collect = (name: string): string => {
      if (!bodies.has(name)) {
        bodies.set(name, '');
        bodies.set(name, renderInput(name, collect));
      }
      return INPUT_ALIAS_PREFIX + name;
    };
    collect(rootName);
    // Hash the complete reachable graph, including resolved scalar mappings.
    // Aliases are shared across operations without conflating different setups.
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify([...bodies].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))))
      .digest('hex')
      .slice(0, 16);
    const reference = (name: string) => `${INPUT_ALIAS_PREFIX}${hash}_${name}`;
    for (const name of bodies.keys()) inputTypes[reference(name)] = renderInput(name, reference);
    return reference(rootName);
  };

  const renderVariable = (type: TypeNode, name: string): string => {
    if (type.kind === Kind.NON_NULL_TYPE) return renderVariableNonNull(type.type, name);
    return `${renderVariableNonNull(type, name)} | null`;
  };
  const renderVariableNonNull = (type: TypeNode, name: string): string =>
    type.kind === Kind.LIST_TYPE ? `(${renderVariable(type.type, name)})[]` : name;

  const definitions = definition.variableDefinitions || [];
  const members = checker.getPropertiesOfType(variables).map((variable) => {
    const definition = definitions.find((item) => item.variable.name.value === variable.getName());
    let type = definition && definition.type;
    while (type && type.kind !== Kind.NAMED_TYPE) type = type.type;
    const inputName = type && input(type.name.value) ? nameInput(type.name.value) : undefined;
    const value =
      inputName && definition
        ? renderVariable(definition.type, inputName)
        : print(checker.getTypeOfSymbolAtLocation(variable, call));
    return `${JSON.stringify(variable.getName())}${variable.flags & ts.SymbolFlags.Optional ? '?' : ''}: ${value};`;
  });
  if (!Object.keys(inputTypes).length) return;
  return {
    documentType: `TadaDocumentNode<${print(arguments_[0])}, { ${members.join(' ')} }, ${print(arguments_[2])}>`,
    inputTypes,
  };
}
