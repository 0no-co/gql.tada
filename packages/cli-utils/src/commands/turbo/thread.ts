import ts from 'typescript';
import v8 from 'node:v8';
import vm from 'node:vm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { GraphQLSPConfig } from '@gql.tada/internal';

import { getSchemaNamesFromConfig, getSchemaConfigForName } from '@gql.tada/internal';
import { findAllCallExpressions } from '@0no-co/graphqlsp/api';

import type { ProgramContainer, PluginCreateInfo } from '../../ts';
import { programFactory } from '../../ts';
import { expose } from '../../threads';

import type {
  TurboSignal,
  TurboWarning,
  TurboDocument,
  GraphQLSourceFile,
  GraphQLSourceImport,
  TurboPath,
} from './types';
import { readCachedTurboDocuments, type CachedTurboDocuments } from './cache';
import { createDocumentHasher } from './hash';
import { shouldScanTurboFile } from './scan';

export interface TurboParams {
  rootPath: string;
  configPath: string;
  pluginConfig: GraphQLSPConfig;
  turboOutputPath: string | TurboPath[];
}

const HEAP_SOFT_LIMIT_BYTES = 2_500 * 1_024 * 1_024;
const TURBO_MAX_BATCH = 1_000;

function traceCallToImportSource(
  callExpression: ts.CallExpression,
  sourceFile: ts.SourceFile,
  program: ts.Program
): string | undefined {
  const typeChecker = program.getTypeChecker();
  const expression = callExpression.expression;

  let identifier: ts.Identifier | undefined;
  if (ts.isIdentifier(expression)) {
    identifier = expression;
  } else if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
    identifier = expression.expression;
  }

  if (!identifier) return undefined;

  const symbol = typeChecker.getSymbolAtLocation(identifier);
  if (!symbol || !symbol.declarations) return undefined;

  for (const declaration of symbol.declarations) {
    const importDeclaration = findImportDeclaration(declaration);
    if (importDeclaration && ts.isStringLiteral(importDeclaration.moduleSpecifier)) {
      const moduleName = importDeclaration.moduleSpecifier.text;
      return resolveModulePath(moduleName, sourceFile, program);
    }
  }

  return undefined;
}

function findImportDeclaration(node: ts.Node): ts.ImportDeclaration | undefined {
  let current: ts.Node | undefined = node;

  while (current) {
    if (ts.isImportDeclaration(current)) {
      return current;
    }
    current = current.parent;
  }

  return undefined;
}

function resolveModulePath(
  moduleName: string,
  containingFile: ts.SourceFile,
  program: ts.Program
): string | undefined {
  const compilerOptions = program.getCompilerOptions();
  const host = ts.createCompilerHost(compilerOptions);

  const resolved = ts.resolveModuleName(moduleName, containingFile.fileName, compilerOptions, host);

  if (resolved.resolvedModule) {
    return resolved.resolvedModule.resolvedFileName;
  }

  return undefined;
}

function collectImportsFromSourceFile(
  sourceFile: ts.SourceFile,
  pluginConfig: GraphQLSPConfig,
  resolveModuleName: (importSpecifier: string, fromPath: string, toPath: string) => string,
  turboOutputPath?: string,
  shouldTreatImportsAsNodeNext?: boolean
): GraphQLSourceImport[] {
  const imports: GraphQLSourceImport[] = [];

  const tadaImportPaths = getTadaOutputPaths(pluginConfig);

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;

      if (!isTadaImport(specifier, sourceFile.fileName, tadaImportPaths)) {
        const importClause = node.getFullText().trim();
        if (turboOutputPath) {
          // Adjust the import specifier to point to the turbo output path
          let adjustedSpecifier = resolveModuleName(
            specifier,
            sourceFile.fileName,
            turboOutputPath
          );

          if (shouldTreatImportsAsNodeNext) {
            if (adjustedSpecifier.endsWith('.ts') || adjustedSpecifier.endsWith('.tsx')) {
              adjustedSpecifier = adjustedSpecifier
                .replace(/\.ts$/, '.js')
                .replace(/\.tsx$/, '.js');
            }
          } else {
            adjustedSpecifier = adjustedSpecifier.replace(/\.ts$/, '').replace(/\.tsx$/, '');
          }

          if (adjustedSpecifier && !adjustedSpecifier.includes('gql.tada')) {
            imports.push({
              specifier: adjustedSpecifier,
              importClause: importClause.replace(specifier, adjustedSpecifier),
            });
          }
        } else {
          imports.push({ specifier, importClause });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

function getTadaOutputPaths(pluginConfig: GraphQLSPConfig): string[] {
  const paths: string[] = [];

  if ('schema' in pluginConfig && pluginConfig.tadaOutputLocation) {
    paths.push(pluginConfig.tadaOutputLocation);
  } else {
    // Multiple schemas aren't supported in this context
  }

  return paths;
}

function isTadaImport(
  importSpecifier: string,
  sourceFilePath: string,
  tadaOutputLocationPaths: string[]
): boolean {
  if (importSpecifier.startsWith('.')) {
    const sourceDir = path.dirname(sourceFilePath);
    const absoluteImportPath = path.resolve(sourceDir, importSpecifier);

    return tadaOutputLocationPaths.some((tadaOutputLocationPath) => {
      const absoluteTadaPath = path.resolve(tadaOutputLocationPath);
      return (
        absoluteImportPath === absoluteTadaPath ||
        absoluteImportPath.startsWith(absoluteTadaPath + path.sep)
      );
    });
  }

  return tadaOutputLocationPaths.some(
    (tadaPath) => importSpecifier === tadaPath || importSpecifier.startsWith(tadaPath + '/')
  );
}

async function* _runTurbo(params: TurboParams): AsyncIterableIterator<TurboSignal> {
  const schemaNames = getSchemaNamesFromConfig(params.pluginConfig);
  const factory = programFactory(params);
  const cachedDocumentsByPath = new Map<string, CachedTurboDocuments>();

  const getCachedDocuments = (schemaName: string | null): CachedTurboDocuments => {
    const turboOutputPath = getTurboOutputPath(params.turboOutputPath, schemaName);
    if (!turboOutputPath) return new Map();

    let cachedDocuments = cachedDocumentsByPath.get(turboOutputPath);
    if (!cachedDocuments) {
      cachedDocuments = readCachedTurboDocuments(turboOutputPath);
      cachedDocumentsByPath.set(turboOutputPath, cachedDocuments);
    }
    return cachedDocuments;
  };

  // NOTE: We add our override declaration here before loading all files
  // This sets `__cacheDisabled` on the turbo cache, which disables the cache temporarily
  // If we don't disable the cache then we couldn't regenerate it from inferred types
  factory.addSourceFile({
    fileId: '__gql-tada-override__.d.ts',
    sourceText: DECLARATION_OVERRIDE,
    scriptKind: ts.ScriptKind.TS,
  });

  const externalFiles = factory.createExternalFiles();
  if (externalFiles.length) {
    yield { kind: 'EXTERNAL_WARNING' };
    await factory.addVirtualFiles(externalFiles);
  }

  // Initially, we only build the program to count files
  // Later, we may reinstantiate to free up memory between batches
  let container = factory.build();
  let pluginInfo = container.buildPluginInfo(params.pluginConfig);
  const turboOutputPaths = new Set(
    getTurboOutputPaths(params.turboOutputPath).map((fileName) => path.resolve(fileName))
  );
  const fileNames = factory.rootFileNames.filter((fileName) =>
    shouldScanTurboFile(fileName, turboOutputPaths)
  );

  yield {
    kind: 'FILE_COUNT',
    fileCount: fileNames.length,
  };

  const uniqueGraphQLSources = new Map<string, GraphQLSourceFile>();

  const processSourceFile = (
    sourceFile: ts.SourceFile,
    container: ProgramContainer,
    pluginInfo: PluginCreateInfo,
    checker: ts.TypeChecker
  ): { filePath: string; documents: TurboDocument[]; warnings: TurboWarning[] } => {
    let filePath = sourceFile.fileName;
    const documents: TurboDocument[] = [];
    const warnings: TurboWarning[] = [];

    const calls = findAllCallExpressions(sourceFile, pluginInfo, false).nodes;
    for (const call of calls) {
      const callExpression = call.node.parent;
      if (!ts.isCallExpression(callExpression)) {
        continue;
      }

      const position = container.getSourcePosition(sourceFile, callExpression.getStart());
      filePath = position.fileName;
      if (!schemaNames.has(call.schema)) {
        warnings.push({
          message: call.schema
            ? `The '${call.schema}' schema is not in the configuration but was referenced by document.`
            : schemaNames.size > 1
              ? 'The document is not for a known schema. Have you re-generated the output file?'
              : 'Multiple schemas are configured, but the document is not for a specific schema.',
          file: position.fileName,
          line: position.line,
          col: position.col,
        });
        continue;
      }

      const graphqlSourcePath = traceCallToImportSource(
        callExpression,
        sourceFile,
        container.program
      );

      if (graphqlSourcePath && !uniqueGraphQLSources.has(graphqlSourcePath)) {
        const graphqlSourceFile = container.program.getSourceFile(graphqlSourcePath);
        if (graphqlSourceFile) {
          const turboPath = getTurboOutputPath(params.turboOutputPath, call.schema);
          const imports = collectImportsFromSourceFile(
            graphqlSourceFile,
            params.pluginConfig,
            factory.resolveModuleName.bind(factory),
            turboPath,
            !!factory.wasOriginallyNodeNext
          );
          uniqueGraphQLSources.set(graphqlSourcePath, {
            absolutePath: graphqlSourcePath,
            imports,
          });
        }
      }

      const argumentKey: string =
        ts.isStringLiteral(call.node) || ts.isNoSubstitutionTemplateLiteral(call.node)
          ? JSON.stringify(call.node.text)
          : checker.typeToString(
              checker.getTypeAtLocation(call.node),
              callExpression,
              BUILDER_FLAGS
            );

      const documentHash = documentHasher.hashCallExpression(callExpression, call.schema);
      const cachedDocument =
        documentHash.hashable && documentHash.documentHash
          ? getCachedDocuments(call.schema).get(argumentKey)
          : undefined;

      let documentType: string;
      let isCached = false;
      if (cachedDocument && cachedDocument.documentHash === documentHash.documentHash) {
        documentType = cachedDocument.documentType;
        isCached = true;
      } else {
        const returnType = checker.getTypeAtLocation(callExpression);
        // NOTE: `returnType.symbol` is incorrectly typed and is in fact
        // optional and not always present
        if (!returnType.symbol || returnType.symbol.getEscapedName() !== 'TadaDocumentNode') {
          warnings.push({
            message:
              `The discovered document is not of type "TadaDocumentNode".\n` +
              'If this is unexpected, please file an issue describing your case.',
            file: position.fileName,
            line: position.line,
            col: position.col,
          });
          continue;
        }

        documentType = checker.typeToString(returnType, callExpression, BUILDER_FLAGS);
      }

      documents.push({
        schemaName: call.schema,
        argumentKey,
        documentType,
        documentHash: documentHash.documentHash,
        isCached,
      });
    }

    return { filePath, documents, warnings };
  };

  const isHeapOverSoftLimit = (): boolean => {
    if (process.memoryUsage().heapUsed < HEAP_SOFT_LIMIT_BYTES) return false;
    forceGc();
    return process.memoryUsage().heapUsed >= HEAP_SOFT_LIMIT_BYTES;
  };

  let checker = container.program.getTypeChecker();
  const documentHasher = createDocumentHasher({
    get checker() {
      return checker;
    },
    schemaFingerprints: computeSchemaFingerprints(params),
  });
  let filesInBatch = 0;

  for (const fileName of fileNames) {
    // When heap or batch limit is reached, rotate out the type checker
    if (filesInBatch > 0 && (filesInBatch >= TURBO_MAX_BATCH || isHeapOverSoftLimit())) {
      container = factory.build();
      pluginInfo = container.buildPluginInfo(params.pluginConfig);
      forceGc();
      checker = container.program.getTypeChecker();
      filesInBatch = 0;
    }

    const sourceFile = container.getSourceFile(fileName);
    if (!sourceFile) continue;

    const { filePath, documents, warnings } = processSourceFile(
      sourceFile,
      container,
      pluginInfo,
      checker
    );
    filesInBatch++;

    yield {
      kind: 'FILE_TURBO',
      filePath,
      documents,
      warnings,
    };
  }

  if (uniqueGraphQLSources.size > 0) {
    yield {
      kind: 'GRAPHQL_SOURCES',
      sources: Array.from(uniqueGraphQLSources.values()),
    };
  }
}

function computeSchemaFingerprints(params: TurboParams): Map<string | null, string> {
  const fingerprints = new Map<string | null, string>();
  const configDir = path.dirname(params.configPath);
  for (const schemaName of getSchemaNamesFromConfig(params.pluginConfig)) {
    const schemaConfig = getSchemaConfigForName(params.pluginConfig, schemaName || undefined);
    const outputLocation = schemaConfig && schemaConfig.tadaOutputLocation;
    if (!outputLocation) continue;

    let contents: string;
    try {
      contents = fs.readFileSync(path.resolve(configDir, outputLocation), 'utf8');
    } catch {
      continue;
    }

    const hash = crypto.createHash('sha256').update(contents).digest('hex');
    fingerprints.set(schemaName, `sha256:${hash.slice(0, 32)}`);
  }
  return fingerprints;
}

function getTurboOutputPath(
  turboOutputPath: string | TurboPath[],
  schemaName: string | null
): string | undefined {
  if (typeof turboOutputPath === 'string') return turboOutputPath;
  return turboOutputPath.find((cfg) => cfg.schemaName === schemaName)?.path;
}

function getTurboOutputPaths(turboOutputPath: string | TurboPath[]): string[] {
  return typeof turboOutputPath === 'string'
    ? [turboOutputPath]
    : turboOutputPath.map((cfg) => cfg.path);
}

let cachedGc: (() => void) | null | undefined;

function forceGc(): void {
  if (cachedGc === undefined) {
    const existing = (globalThis as { gc?: () => void }).gc;
    if (typeof existing === 'function') {
      cachedGc = existing;
    } else {
      // NOTE: If gc isn't available, try to retrieve it via `node:vm`
      try {
        v8.setFlagsFromString('--expose-gc');
        cachedGc = vm.runInNewContext('gc') as () => void;
        v8.setFlagsFromString('--no-expose-gc');
      } catch {
        cachedGc = null;
      }
    }
  }
  if (cachedGc) cachedGc();
}

export const runTurbo = expose(_runTurbo);

const BUILDER_FLAGS: ts.TypeFormatFlags =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.NoTypeReduction |
  ts.TypeFormatFlags.InTypeAlias |
  ts.TypeFormatFlags.UseFullyQualifiedType |
  ts.TypeFormatFlags.GenerateNamesForShadowedTypeParams |
  ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
  ts.TypeFormatFlags.AllowUniqueESSymbolType |
  ts.TypeFormatFlags.WriteTypeArgumentsOfSignature;

const DECLARATION_OVERRIDE = `
import * as _gqlTada from 'gql.tada';
declare module 'gql.tada' {
  interface setupCache {
    readonly __cacheDisabled: true;
  }
}
`.trim();
