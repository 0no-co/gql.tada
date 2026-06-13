import ts from 'typescript';
import v8 from 'node:v8';
import vm from 'node:vm';
import { getSchemaNamesFromConfig } from '@gql.tada/internal';
import { findAllCallExpressions } from '@0no-co/graphqlsp/api';

import type { ProgramContainer, PluginCreateInfo } from '../../ts';
import { programFactory } from '../../ts';
import { expose } from '../../threads';
import { hasGraphQLDocumentCandidate } from '../turbo/scan';

import type { ScanParams, ScanSignal, RawScanDocument, ScanWarning } from './types';

const HEAP_SOFT_LIMIT_BYTES = 2_500 * 1_024 * 1_024;
const SCAN_MAX_BATCH = 1_000;

function shouldScanFile(fileName: string): boolean {
  if (fileName.endsWith('.d.ts') || fileName.endsWith('.d.mts') || fileName.endsWith('.d.cts')) {
    return false;
  }
  return !/(^|[/\\])node_modules([/\\]|$)/.test(fileName);
}

function collectModuleImports(
  sourceFile: ts.SourceFile,
  resolveModulePath: (importSpecifier: string, fromPath: string) => string | undefined
): string[] {
  const imports: string[] = [];
  for (const node of sourceFile.statements) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const resolved = resolveModulePath(node.moduleSpecifier.text, sourceFile.fileName);
      if (resolved && shouldScanFile(resolved)) imports.push(resolved);
    }
  }
  return imports;
}

async function* _runScan(params: ScanParams): AsyncIterableIterator<ScanSignal> {
  const schemaNames = getSchemaNamesFromConfig(params.pluginConfig);
  const factory = programFactory(params);

  // NOTE: As in turbo, this disables the turbo cache so that, when measuring
  // types, we evaluate the actual inferred document types rather than cached ones.
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

  let container = factory.build();
  let pluginInfo = container.buildPluginInfo(params.pluginConfig);
  const fileNames = factory.rootFileNames.filter(shouldScanFile);

  yield { kind: 'FILE_COUNT', fileCount: fileNames.length };

  const processSourceFile = (
    sourceFile: ts.SourceFile,
    container: ProgramContainer,
    pluginInfo: PluginCreateInfo,
    checker: ts.TypeChecker | undefined
  ): {
    filePath: string;
    documents: RawScanDocument[];
    imports: string[];
    warnings: ScanWarning[];
  } => {
    let filePath = sourceFile.fileName;
    const documents: RawScanDocument[] = [];
    const warnings: ScanWarning[] = [];

    if (!hasGraphQLDocumentCandidate(sourceFile)) {
      return { filePath, documents, imports: [], warnings };
    }

    const calls = findAllCallExpressions(sourceFile, pluginInfo, {
      searchExternal: false,
      collectFragments: false,
    }).nodes;

    for (const call of calls) {
      const callExpression = call.node.parent;
      if (!ts.isCallExpression(callExpression)) continue;

      const position = container.getSourcePosition(sourceFile, callExpression.getStart());
      filePath = position.fileName;

      if (!schemaNames.has(call.schema)) {
        warnings.push({
          message: call.schema
            ? `The '${call.schema}' schema is not in the configuration but was referenced by a document.`
            : schemaNames.size > 1
              ? 'The document is not for a known schema. Have you re-generated the output file?'
              : 'Multiple schemas are configured, but the document is not for a specific schema.',
          file: position.fileName,
          line: position.line,
          col: position.col,
        });
        continue;
      }

      let typeString: string | undefined;
      let typeSize: number | undefined;
      if (checker) {
        const returnType = checker.getTypeAtLocation(callExpression);
        // NOTE: `returnType.symbol` is incorrectly typed and is in fact
        // optional and not always present
        if (returnType.symbol && returnType.symbol.getEscapedName() === 'TadaDocumentNode') {
          typeString = checker.typeToString(returnType, callExpression, BUILDER_FLAGS);
          typeSize = typeString.length;
        }
      }

      documents.push({
        schemaName: call.schema,
        document: call.node.text,
        filePath: position.fileName,
        line: position.line,
        col: position.col,
        typeString,
        typeSize,
      });
    }

    const imports = documents.length
      ? collectModuleImports(sourceFile, factory.resolveModulePath.bind(factory))
      : [];

    return { filePath, documents, imports, warnings };
  };

  const isHeapOverSoftLimit = (): boolean => {
    if (process.memoryUsage().heapUsed < HEAP_SOFT_LIMIT_BYTES) return false;
    forceGc();
    return process.memoryUsage().heapUsed >= HEAP_SOFT_LIMIT_BYTES;
  };

  let checker = params.measureTypes ? container.program.getTypeChecker() : undefined;
  let filesInBatch = 0;

  for (const fileName of fileNames) {
    // When heap or batch limit is reached, rotate out the type checker
    if (filesInBatch > 0 && (filesInBatch >= SCAN_MAX_BATCH || isHeapOverSoftLimit())) {
      container = factory.build();
      pluginInfo = container.buildPluginInfo(params.pluginConfig);
      forceGc();
      checker = params.measureTypes ? container.program.getTypeChecker() : undefined;
      filesInBatch = 0;
    }

    const sourceFile = container.getSourceFile(fileName);
    if (!sourceFile) continue;

    const { filePath, documents, imports, warnings } = processSourceFile(
      sourceFile,
      container,
      pluginInfo,
      checker
    );
    filesInBatch++;

    yield { kind: 'FILE_SCAN', filePath, documents, imports, warnings };
  }
}

let cachedGc: (() => void) | null | undefined;

function forceGc(): void {
  if (cachedGc === undefined) {
    const existing = (globalThis as { gc?: () => void }).gc;
    if (typeof existing === 'function') {
      cachedGc = existing;
    } else {
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

export const runScan = expose(_runScan);

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
