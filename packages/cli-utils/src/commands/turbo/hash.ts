import ts from 'typescript';
import * as crypto from 'node:crypto';

// NOTE(@kitten): Change if document type input or output changes
const CACHE_BUSTER = 'turbo-document-hash-v2';

export const BUILDER_FLAGS: ts.TypeFormatFlags =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.NoTypeReduction |
  ts.TypeFormatFlags.InTypeAlias |
  ts.TypeFormatFlags.UseFullyQualifiedType |
  ts.TypeFormatFlags.GenerateNamesForShadowedTypeParams |
  ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
  ts.TypeFormatFlags.AllowUniqueESSymbolType |
  ts.TypeFormatFlags.WriteTypeArgumentsOfSignature;

export interface DocumentHashResult {
  hashable: boolean;
  documentHash?: string;
}

export interface DocumentHasher {
  hashCallExpression(
    callExpression: ts.CallExpression,
    schemaName: string | null
  ): DocumentHashResult;
}

interface HashContext {
  readonly checker: ts.TypeChecker;
  schemaFingerprints: ReadonlyMap<string | null, string>;
}

export function createDocumentHasher(context: HashContext): DocumentHasher {
  const callExpressionCache = new WeakMap<ts.CallExpression, Map<string, DocumentHashResult>>();
  const symbolCallCache = new Map<ts.Symbol, ts.CallExpression | null>();
  const activeCalls = new WeakSet<ts.CallExpression>();
  const setupFingerprintCache = new WeakMap<ts.Type, string>();

  const hashCallExpression = (
    callExpression: ts.CallExpression,
    schemaName: string | null
  ): DocumentHashResult => {
    const schemaKey = schemaName || '';
    const cached = callExpressionCache.get(callExpression)?.get(schemaKey);
    if (cached) {
      return cached;
    } else if (activeCalls.has(callExpression)) {
      return { hashable: false };
    }

    activeCalls.add(callExpression);
    const result = computeCallExpressionHash(callExpression, schemaName);
    activeCalls.delete(callExpression);

    let schemaCache = callExpressionCache.get(callExpression);
    if (!schemaCache) {
      schemaCache = new Map();
      callExpressionCache.set(callExpression, schemaCache);
    }

    schemaCache.set(schemaKey, result);
    return result;
  };

  const computeCallExpressionHash = (
    callExpression: ts.CallExpression,
    schemaName: string | null
  ): DocumentHashResult => {
    const documentText = getStaticStringValue(callExpression.arguments[0]);
    if (documentText == null) {
      return { hashable: false };
    }

    const fragmentHashes = getFragmentHashes(callExpression.arguments[1], schemaName);
    if (!fragmentHashes) {
      return { hashable: false };
    }

    const hash = crypto.createHash('sha256');

    addHashPart(hash, CACHE_BUSTER);
    addHashPart(hash, schemaName || '');
    addHashPart(hash, context.schemaFingerprints.get(schemaName) || '');
    addHashPart(hash, getSetupFingerprint(callExpression));
    addHashPart(hash, documentText);
    for (const fragmentHash of fragmentHashes) {
      addHashPart(hash, fragmentHash);
    }

    return {
      hashable: true,
      documentHash: `sha256:${hash.digest('hex').slice(0, 32)}`,
    };
  };

  const getSetupFingerprint = (callExpression: ts.CallExpression): string => {
    const calleeType = context.checker.getTypeAtLocation(callExpression.expression);
    let fingerprint = setupFingerprintCache.get(calleeType);
    if (fingerprint == null) {
      fingerprint = computeSetupFingerprint(calleeType, callExpression);
      setupFingerprintCache.set(calleeType, fingerprint);
    }
    return fingerprint;
  };

  const computeSetupFingerprint = (calleeType: ts.Type, node: ts.Node): string => {
    const { checker } = context;
    const printType = (type: ts.Type) => checker.typeToString(type, undefined, BUILDER_FLAGS);
    const getTypeOfProperty = (property: ts.Symbol) =>
      checker.getTypeOfSymbolAtLocation(property, node);
    // NOTE: Sorted, so that reordering the setup's or scalars' properties keeps the fingerprint
    const getProperties = (type: ts.Type) =>
      checker
        .getPropertiesOfType(type)
        .slice()
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    // NOTE: A named scalars type (e.g. `scalars: Scalars`) would only print as its name, while the
    // cached document types contain what each scalar resolves to, so we print each member instead
    const printScalars = (type: ts.Type) => {
      let output = '';
      for (const property of getProperties(type))
        output += `${property.name}: ${printType(getTypeOfProperty(property))};\n`;
      for (const info of checker.getIndexInfosOfType(type))
        output += `[key: ${printType(info.keyType)}]: ${printType(info.type)};\n`;
      return `{\n${output}}`;
    };

    // NOTE: The `graphql` function's type is usually `initGraphQLTada<Setup>`. The introspection
    // is already covered by the schema fingerprint, so we only print the remaining options, e.g.
    // `scalars` and `disableMasking`. These are printed like the document types are, so a change
    // to what a scalar resolves to (even when it's imported) changes the fingerprint
    const setupType =
      calleeType.aliasSymbol &&
      calleeType.aliasSymbol.name === 'initGraphQLTada' &&
      calleeType.aliasTypeArguments &&
      calleeType.aliasTypeArguments[0];
    if (setupType) {
      let fingerprint = '';
      for (const property of getProperties(setupType)) {
        if (property.name === 'introspection') continue;
        const propertyType = getTypeOfProperty(property);
        const printed =
          property.name === 'scalars'
            ? printScalars(checker.getNonNullableType(propertyType))
            : printType(propertyType);
        fingerprint += `${property.name}: ${printed};\n`;
      }
      return fingerprint;
    }

    // Otherwise, fall back to the `GraphQLTadaAPI<Schema, Config>` type arguments. Of the schema,
    // only scalar entries have a `type` and the rest is covered by the schema fingerprint. Printing
    // all of it would make every document depend on the whole schema and can be very large
    const typeArguments =
      calleeType.flags & ts.TypeFlags.Object &&
      (calleeType as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
        ? checker
            .getTypeArguments(calleeType as ts.TypeReference)
            .slice(0, ((calleeType as ts.TypeReference).target.typeParameters || []).length)
        : [calleeType];
    return typeArguments
      .map((type) => {
        const typesProperty = checker.getPropertyOfType(type, 'types');
        if (!typesProperty) return printType(type);
        let output = '';
        for (const property of getProperties(getTypeOfProperty(typesProperty))) {
          const scalarProperty = checker.getPropertyOfType(getTypeOfProperty(property), 'type');
          if (scalarProperty)
            output += `${property.name}: ${printType(getTypeOfProperty(scalarProperty))};\n`;
        }
        return output;
      })
      .join('\n');
  };

  const getFragmentHashes = (
    fragmentsExpression: ts.Expression | undefined,
    schemaName: string | null
  ): string[] | null => {
    if (!fragmentsExpression) return [];

    fragmentsExpression = unwrapExpression(fragmentsExpression);

    if (ts.isArrayLiteralExpression(fragmentsExpression)) {
      const hashes: string[] = [];
      for (const element of fragmentsExpression.elements) {
        if (ts.isSpreadElement(element)) {
          const spreadHashes = getFragmentHashes(element.expression, schemaName);
          if (!spreadHashes) return null;
          hashes.push(...spreadHashes);
          continue;
        }

        const documentCall = resolveDocumentCallExpression(element);
        if (!documentCall) return null;

        const fragmentHash = hashCallExpression(documentCall, schemaName);
        if (!fragmentHash.hashable || !fragmentHash.documentHash) return null;
        hashes.push(fragmentHash.documentHash);
      }
      return hashes;
    }

    const declarationExpression = resolveDeclarationInitializer(fragmentsExpression);
    if (declarationExpression && declarationExpression !== fragmentsExpression) {
      return getFragmentHashes(declarationExpression, schemaName);
    }

    return null;
  };

  const resolveDocumentCallExpression = (expression: ts.Expression): ts.CallExpression | null => {
    expression = unwrapExpression(expression);
    if (ts.isCallExpression(expression)) return expression;

    const symbol = getSymbol(expression);
    if (!symbol) return null;

    const cached = symbolCallCache.get(symbol);
    if (cached !== undefined) return cached;

    const callExpression = resolveSymbolCallExpression(symbol);
    symbolCallCache.set(symbol, callExpression);
    return callExpression;
  };

  const resolveDeclarationInitializer = (expression: ts.Expression): ts.Expression | null => {
    const symbol = getSymbol(expression);
    if (!symbol) return null;

    for (const declaration of symbol.declarations || []) {
      if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
        return declaration.initializer;
      }
    }

    return null;
  };

  const resolveSymbolCallExpression = (symbol: ts.Symbol): ts.CallExpression | null => {
    for (const declaration of symbol.declarations || []) {
      if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
        const initializer = unwrapExpression(declaration.initializer);
        if (ts.isCallExpression(initializer)) return initializer;
      }
    }
    return null;
  };

  const getSymbol = (expression: ts.Expression): ts.Symbol | undefined => {
    let symbol = context.checker.getSymbolAtLocation(expression);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
      symbol = context.checker.getAliasedSymbol(symbol);
    }
    return symbol;
  };

  return { hashCallExpression };
}

function getStaticStringValue(expression: ts.Expression | undefined): string | undefined {
  if (!expression) return undefined;
  expression = unwrapExpression(expression);

  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }

  return undefined;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  while (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    expression = expression.expression;
  }
  return expression;
}

function addHashPart(hash: crypto.Hash, part: string): void {
  hash.update(`${part.length}:`);
  hash.update(part);
  hash.update('\0');
}
