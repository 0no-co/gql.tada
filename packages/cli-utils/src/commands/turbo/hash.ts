import ts from 'typescript';
import * as crypto from 'node:crypto';
import type { GraphQLSPConfig } from '@gql.tada/internal';

// NOTE(@kitten): Change if document type input or output changes
const CACHE_BUSTER = 'turbo-document-hash-v1';

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
  pluginConfig: GraphQLSPConfig;
}

export function createDocumentHasher(context: HashContext): DocumentHasher {
  const callExpressionCache = new WeakMap<ts.CallExpression, Map<string, DocumentHashResult>>();
  const symbolCallCache = new Map<ts.Symbol, ts.CallExpression | null>();
  const activeCalls = new WeakSet<ts.CallExpression>();

  let _pluginConfigKey: string | null;
  const computePluginConfigKey = () => {
    if (_pluginConfigKey == null) {
      _pluginConfigKey = stableStringify(context.pluginConfig);
    }
    return _pluginConfigKey;
  };

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
    addHashPart(hash, computePluginConfigKey());
    addHashPart(hash, documentText);
    for (const fragmentHash of fragmentHashes) {
      addHashPart(hash, fragmentHash);
    }

    return {
      hashable: true,
      documentHash: `sha256:${hash.digest('hex').slice(0, 32)}`,
    };
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

    let initializer = resolveDeclarationInitializer(expression);
    if (initializer) {
      initializer = unwrapExpression(initializer);
      if (ts.isCallExpression(initializer)) return initializer;
    }

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

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== 'object') return JSON.stringify(input) ?? 'undefined';
  if (Array.isArray(input)) return `[${input.map(stableStringify).join(',')}]`;

  const record = input as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}
