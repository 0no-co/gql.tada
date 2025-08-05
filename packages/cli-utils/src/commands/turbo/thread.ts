import ts from 'typescript';
import * as path from 'node:path';
import type { GraphQLSPConfig } from '@gql.tada/internal';

import { getSchemaNamesFromConfig } from '@gql.tada/internal';
import { findAllCallExpressions } from '@0no-co/graphqlsp/api';

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

export interface TurboParams {
  rootPath: string;
  configPath: string;
  pluginConfig: GraphQLSPConfig;
  turboOutputPath: string | TurboPath[];
}

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
  compilerOptions?: ts.CompilerOptions
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

          // Handle nodenext module resolution - preserve .js extensions, convert .ts/.tsx to .js
          // because resolveModuleName returns the .ts/.tsx file
          const isNodeNext =
            compilerOptions?.moduleResolution === ts.ModuleResolutionKind.NodeNext ||
            compilerOptions?.moduleResolution === ts.ModuleResolutionKind.Node16;

          if (isNodeNext) {
            // For nodenext, we need to ensure the specifier has proper extensions
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

  const container = factory.build();
  const pluginInfo = container.buildPluginInfo(params.pluginConfig);
  const sourceFiles = container.getSourceFiles();

  yield {
    kind: 'FILE_COUNT',
    fileCount: sourceFiles.length,
  };

  const checker = container.program.getTypeChecker();
  const uniqueGraphQLSources = new Map<string, GraphQLSourceFile>();

  for (const sourceFile of sourceFiles) {
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
          const turboPath = Array.isArray(params.turboOutputPath)
            ? params.turboOutputPath.find((cfg) => cfg.schemaName === call.schema)?.path
            : params.turboOutputPath;
          const imports = collectImportsFromSourceFile(
            graphqlSourceFile,
            params.pluginConfig,
            factory.resolveModuleName.bind(factory),
            turboPath,
            container.program.getCompilerOptions()
          );
          uniqueGraphQLSources.set(graphqlSourcePath, {
            absolutePath: graphqlSourcePath,
            imports,
          });
        }
      }

      const returnType = checker.getTypeAtLocation(callExpression);
      const argumentType = checker.getTypeAtLocation(call.node);
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

      const argumentKey: string =
        'value' in argumentType &&
        typeof argumentType.value === 'string' &&
        (argumentType.flags & ts.TypeFlags.StringLiteral) === 0
          ? JSON.stringify(argumentType.value)
          : checker.typeToString(argumentType, callExpression, BUILDER_FLAGS);
      const documentType = checker.typeToString(returnType, callExpression, BUILDER_FLAGS);

      documents.push({
        schemaName: call.schema,
        argumentKey,
        documentType,
      });
    }

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
