import ts from 'typescript';
import * as path from 'node:path';
import type { GraphQLSPConfig } from '@gql.tada/internal';
import { createVirtualLanguageServiceHost } from './vendor/typescript-vfs';

import type { VirtualMap, SourceMappedFile, FileSpan } from './mapping';

import type { SourcePosition } from './utils';
import { spanToFilePosition } from './utils';

function maybeBind<T extends Function>(that: object, fn: T | undefined): T {
  return fn ? fn.bind(that) : fn;
}

export interface PluginCreateInfo<Config extends {} = GraphQLSPConfig>
  extends ts.server.PluginCreateInfo {
  config: Config;
}

export interface ProgramContainer {
  readonly program: ts.Program;
  readonly languageService: ts.LanguageService;
  buildPluginInfo<Config extends {}>(config: Config): PluginCreateInfo<Config>;

  getSourceFile(fileId: string): ts.SourceFile | undefined;
  getSourceFiles(): readonly ts.SourceFile[];
  getSourceMappedFile(fileId: string | ts.SourceFile): SourceMappedFile | undefined;
  getSourceSpan(fileId: string | ts.SourceFile, span: ts.TextSpan | number): FileSpan;
  getSourcePosition(fileId: string | ts.SourceFile, span: ts.TextSpan | number): SourcePosition;
}

export interface ContainerParams {
  virtualMap: VirtualMap;
  projectRoot: string;
  compilerHost: ts.CompilerHost;
  rootNames: readonly string[];
  options: ts.CompilerOptions;
  system: ts.System;
}

export const buildContainer = (params: ContainerParams): ProgramContainer => {
  let program: ts.Program | undefined;
  let service: ts.LanguageService | undefined;
  let serviceHost: ts.LanguageServiceHost | undefined;
  let pluginInfo: PluginCreateInfo<any> | undefined;

  const getLanguageServiceHost = () =>
    serviceHost ||
    (serviceHost = createVirtualLanguageServiceHost(
      params.system,
      [...params.rootNames],
      params.options,
      ts
    ).languageServiceHost);

  const getLanguageService = () =>
    service ||
    (service = buildLanguageService({
      system: params.system,
      rootNames: params.rootNames,
      virtualMap: params.virtualMap,
      options: params.options,
      projectRoot: params.projectRoot,
      languageServiceHost: getLanguageServiceHost(),
    }));

  const getProgram = () => {
    if (!program) {
      program =
        getLanguageService().getProgram() ||
        ts.createProgram({
          rootNames: params.rootNames,
          options: params.options,
          host: params.compilerHost,
        });
    }
    return program;
  };

  return {
    get program() {
      return getProgram();
    },
    get languageService() {
      return getLanguageService();
    },
    buildPluginInfo(config) {
      return (
        pluginInfo ||
        (pluginInfo = buildPluginInfo({
          getLanguageService,
          getLanguageServiceHost,
          projectRoot: params.projectRoot,
          rootNames: params.rootNames,
          system: params.system,
          options: params.options,
          config,
        }))
      );
    },

    getSourceFile(fileId) {
      return getProgram().getSourceFile(fileId);
    },
    getSourceFiles() {
      return getProgram().getSourceFiles();
    },
    getSourceMappedFile(file) {
      const fileId = typeof file !== 'string' ? file.fileName : file;
      return params.virtualMap.get(fileId);
    },
    getSourceSpan(file, span) {
      const fileId = typeof file !== 'string' ? file.fileName : file;
      const mappedFile = params.virtualMap.get(fileId);
      return mappedFile
        ? mappedFile.getSourceSpan(span)
        : {
            fileName: fileId,
            start: typeof span !== 'number' ? span.start : span,
            length: typeof span !== 'number' ? span.length : 1,
          };
    },
    getSourcePosition(file, position) {
      const fileId = typeof file !== 'string' ? file.fileName : file;
      const mappedFile = params.virtualMap.get(fileId);
      if (mappedFile) {
        const span = mappedFile.getSourceSpan(position);
        if (span.fileName === mappedFile.sourceFileId)
          return spanToFilePosition(mappedFile.sourceFile, span);
      }
      return spanToFilePosition(
        typeof file === 'string' ? getProgram().getSourceFile(file)! : file,
        position
      );
    },
  };
};

const buildProgram = (params: {
  program: ts.Program;
  virtualMap: VirtualMap;
  projectRoot: string;
}): ts.Program => {
  const { program, virtualMap, projectRoot } = params;

  const isSourceFileFromExternalLibrary = maybeBind(
    program,
    program.isSourceFileFromExternalLibrary
  );
  const getModeForResolutionAtIndex = maybeBind(program, program.getModeForResolutionAtIndex);
  const getSourceFile = maybeBind(program, program.getSourceFile);
  const getSourceFiles = maybeBind(program, program.getSourceFiles);

  /** Remap source file to generated source file if it's a mapped file */
  const mapSourceFileFn =
    <TReturn, TArgs extends readonly any[]>(
      fileFn: (file: ts.SourceFile, ...args: TArgs) => TReturn
    ) =>
    (file: ts.SourceFile | undefined, ...args: TArgs): TReturn => {
      const mappedFile = file && virtualMap.get(file.fileName);
      if (mappedFile && mappedFile.sourceFileId === file?.fileName)
        file = getSourceFile(mappedFile.generatedFileId) || file;
      return fileFn.call(program, file!, ...args);
    };

  return Object.assign(program, {
    getSyntacticDiagnostics: mapSourceFileFn(program.getSyntacticDiagnostics),
    getSemanticDiagnostics: mapSourceFileFn(program.getSemanticDiagnostics),
    getDeclarationDiagnostics: mapSourceFileFn(program.getDeclarationDiagnostics),
    isSourceFileDefaultLibrary: mapSourceFileFn(program.isSourceFileDefaultLibrary),
    getModeForUsageLocation: mapSourceFileFn(program.getModeForUsageLocation),

    isSourceFileFromExternalLibrary(source) {
      const mappedFile = virtualMap.get(source.fileName);
      return (
        !!(mappedFile && mappedFile.sourceFileId === source.fileName) ||
        isSourceFileFromExternalLibrary(source)
      );
    },

    getSourceFiles() {
      const sourceFiles: ts.SourceFile[] = [];
      for (const sourceFile of getSourceFiles()) {
        const relativePath = path.relative(projectRoot, sourceFile.fileName);
        if (
          !relativePath.startsWith('..') &&
          !program.isSourceFileFromExternalLibrary(sourceFile)
        ) {
          sourceFiles.push(sourceFile);
        }
      }
      return sourceFiles;
    },

    getSourceFile(fileId) {
      const mappedFile = virtualMap.get(fileId);
      if (mappedFile && mappedFile.sourceFileId === fileId) fileId = mappedFile.generatedFileId;
      return getSourceFile(fileId);
    },

    getModeForResolutionAtIndex(file, index) {
      const mappedFile = virtualMap.get(file.fileName);
      if (mappedFile && mappedFile.sourceFileId === file.fileName) {
        file = getSourceFile(mappedFile.generatedFileId) || file;
        index = mappedFile.getGeneratedOffset(index)?.[0] ?? index;
      }
      return getModeForResolutionAtIndex(file, index);
    },
  } satisfies Partial<ts.Program>);
};

const buildLanguageService = (params: {
  virtualMap: VirtualMap;
  languageServiceHost: ts.LanguageServiceHost;
  system: ts.System;
  rootNames: readonly string[];
  projectRoot: string;
  options: ts.CompilerOptions;
}): ts.LanguageService => {
  const { virtualMap } = params;
  const languageService = ts.createLanguageService(params.languageServiceHost);
  const getProgram = maybeBind(languageService, languageService.getProgram);

  /** Remap filename to generated file if it's a mapped file */
  const mapFileFn =
    <TReturn, TArgs extends readonly any[]>(fileFn: (fileId: string, ...args: TArgs) => TReturn) =>
    (fileId: string, ...args: TArgs): TReturn => {
      const mappedFile = virtualMap.get(fileId);
      if (mappedFile && mappedFile.sourceFileId === fileId) fileId = mappedFile.generatedFileId;
      return fileFn.call(languageService, fileId, ...args);
    };

  /** Remap input to generated file and span if it's a mapped file */
  const mapFileTextSpanFn =
    <TReturn, TArgs extends readonly any[]>(
      textSpanFn: (fileId: string, span: ts.TextSpan, ...args: TArgs) => TReturn
    ) =>
    (fileId: string, span: ts.TextSpan, ...args: TArgs): TReturn => {
      const mappedFile = virtualMap.get(fileId);
      if (mappedFile && mappedFile.sourceFileId === fileId) {
        fileId = mappedFile.generatedFileId;
        const start = mappedFile.getGeneratedOffset(span.start)?.[0];
        const end = mappedFile.getGeneratedOffset(span.start + span.length - 1)?.[0];
        if (start != null) {
          span = { start, length: span.length };
          if (end != null) span.length = end - start + 1;
        }
      }
      return textSpanFn.call(languageService, fileId, span, ...args);
    };

  /** Remap input to generated file and range if it's a mapped file */
  const mapFileTextRangeFn =
    <TReturn, TArgs extends readonly any[]>(
      textSpanFn: (fileId: string, range: ts.TextRange, ...args: TArgs) => TReturn
    ) =>
    (fileId: string, range: ts.TextRange, ...args: TArgs): TReturn => {
      const mappedFile = virtualMap.get(fileId);
      if (mappedFile && mappedFile.sourceFileId === fileId) {
        fileId = mappedFile.generatedFileId;
        const pos = mappedFile.getGeneratedOffset(range.pos)?.[0];
        const end = mappedFile.getGeneratedOffset(range.end)?.[0];
        if (pos != null) {
          range = { pos, end: pos + (range.end - range.pos) };
          if (end != null) range.end = end;
        }
      }
      return textSpanFn.call(languageService, fileId, range, ...args);
    };

  /** Remap input to generated file and position if it's a mapped file */
  const mapFilePositionFn =
    <TReturn, TArgs extends readonly any[]>(
      positionFn: (fileId: string, position: number, ...args: TArgs) => TReturn
    ) =>
    (fileId: string, position: number, ...args: TArgs): TReturn => {
      const mappedFile = virtualMap.get(fileId);
      if (mappedFile && mappedFile.sourceFileId === fileId) {
        fileId = mappedFile.generatedFileId;
        position = mappedFile.getGeneratedOffset(position)?.[0] ?? position;
      }
      return positionFn.call(languageService, fileId, position, ...args);
    };

  /** Remap input to generated file and position if it's a mapped file */
  const mapFileStartEndFn =
    <TReturn, TArgs extends readonly any[]>(
      positionFn: (fileId: string, start: number, end: number, ...args: TArgs) => TReturn
    ) =>
    (fileId: string, start: number, end: number, ...args: TArgs): TReturn => {
      const mappedFile = virtualMap.get(fileId);
      if (mappedFile && mappedFile.sourceFileId === fileId) {
        fileId = mappedFile.generatedFileId;
        start = mappedFile.getGeneratedOffset(start)?.[0] ?? start;
        end = mappedFile.getGeneratedOffset(end)?.[0] ?? end;
      }
      return positionFn.call(languageService, fileId, start, end, ...args);
    };

  let program: ts.Program | undefined;

  return Object.assign(languageService, {
    getProgram() {
      if (program) {
        return program;
      } else {
        const serviceProgram = getProgram();
        return serviceProgram
          ? (program = buildProgram({
              program: serviceProgram,
              virtualMap: params.virtualMap,
              projectRoot: params.projectRoot,
            }))
          : undefined;
      }
    },

    getReferencesAtPosition: mapFilePositionFn(languageService.getReferencesAtPosition),
    findReferences: mapFilePositionFn(languageService.findReferences),
    getDefinitionAtPosition: mapFilePositionFn(languageService.getDefinitionAtPosition),
    getDefinitionAndBoundSpan: mapFilePositionFn(languageService.getDefinitionAndBoundSpan),
    getTypeDefinitionAtPosition: mapFilePositionFn(languageService.getTypeDefinitionAtPosition),
    getImplementationAtPosition: mapFilePositionFn(languageService.getImplementationAtPosition),
    getCompletionsAtPosition: mapFilePositionFn(languageService.getCompletionsAtPosition),
    getCompletionEntryDetails: mapFilePositionFn(languageService.getCompletionEntryDetails),
    getCompletionEntrySymbol: mapFilePositionFn(languageService.getCompletionEntrySymbol),
    getQuickInfoAtPosition: mapFilePositionFn(languageService.getQuickInfoAtPosition),
    getBreakpointStatementAtPosition: mapFilePositionFn(
      languageService.getBreakpointStatementAtPosition
    ),
    getSignatureHelpItems: mapFilePositionFn(languageService.getSignatureHelpItems),
    getRenameInfo: mapFilePositionFn(languageService.getRenameInfo),
    getSmartSelectionRange: mapFilePositionFn(languageService.getSmartSelectionRange),
    getDocumentHighlights: mapFilePositionFn(languageService.getDocumentHighlights),
    prepareCallHierarchy: mapFilePositionFn(languageService.prepareCallHierarchy),
    provideCallHierarchyIncomingCalls: mapFilePositionFn(
      languageService.provideCallHierarchyIncomingCalls
    ),
    provideCallHierarchyOutgoingCalls: mapFilePositionFn(
      languageService.provideCallHierarchyOutgoingCalls
    ),
    getBraceMatchingAtPosition: mapFilePositionFn(languageService.getBraceMatchingAtPosition),
    getIndentationAtPosition: mapFilePositionFn(languageService.getIndentationAtPosition),
    getFormattingEditsAfterKeystroke: mapFilePositionFn(
      languageService.getFormattingEditsAfterKeystroke
    ),
    getDocCommentTemplateAtPosition: mapFilePositionFn(
      languageService.getDocCommentTemplateAtPosition
    ),
    isValidBraceCompletionAtPosition: mapFilePositionFn(
      languageService.isValidBraceCompletionAtPosition
    ),
    getJsxClosingTagAtPosition: mapFilePositionFn(languageService.getJsxClosingTagAtPosition),
    getLinkedEditingRangeAtPosition: mapFilePositionFn(
      languageService.getLinkedEditingRangeAtPosition
    ),
    getSpanOfEnclosingComment: mapFilePositionFn(languageService.getSpanOfEnclosingComment),

    getSyntacticClassifications: mapFileTextSpanFn(
      languageService.getSyntacticClassifications
    ) as typeof languageService.getSyntacticClassifications,
    getSemanticClassifications: mapFileTextSpanFn(
      languageService.getSemanticClassifications
    ) as typeof languageService.getSemanticClassifications,
    getEncodedSyntacticClassifications: mapFileTextSpanFn(
      languageService.getEncodedSyntacticClassifications
    ),
    getEncodedSemanticClassifications: mapFileTextSpanFn(
      languageService.getEncodedSemanticClassifications
    ),
    provideInlayHints: mapFileTextSpanFn(languageService.provideInlayHints),

    getNameOrDottedNameSpan: mapFileStartEndFn(languageService.getNameOrDottedNameSpan),
    getFormattingEditsForRange: mapFileStartEndFn(languageService.getFormattingEditsForRange),
    getCodeFixesAtPosition: mapFileStartEndFn(languageService.getCodeFixesAtPosition),

    getFileReferences: mapFileFn(languageService.getFileReferences),
    getNavigationBarItems: mapFileFn(languageService.getNavigationBarItems),
    getNavigationTree: mapFileFn(languageService.getNavigationTree),
    getOutliningSpans: mapFileFn(languageService.getOutliningSpans),
    getTodoComments: mapFileFn(languageService.getTodoComments),
    getFormattingEditsForDocument: mapFileFn(languageService.getFormattingEditsForDocument),
    getEditsForRefactor: mapFileFn(languageService.getEditsForRefactor),
    getEmitOutput: mapFileFn(languageService.getEmitOutput),
    getSuggestionDiagnostics: mapFileFn(languageService.getSuggestionDiagnostics),
    getSemanticDiagnostics: mapFileFn(languageService.getSemanticDiagnostics),
    getSyntacticDiagnostics: mapFileFn(languageService.getSyntacticDiagnostics),
    getSupportedCodeFixes: mapFileFn(languageService.getSupportedCodeFixes),

    toggleLineComment: mapFileTextRangeFn(languageService.toggleLineComment),
    toggleMultilineComment: mapFileTextRangeFn(languageService.toggleMultilineComment),
    commentSelection: mapFileTextRangeFn(languageService.commentSelection),
    uncommentSelection: mapFileTextRangeFn(languageService.uncommentSelection),
  } satisfies Partial<ts.LanguageService>);
};

const buildPluginInfo = <Config extends {}>(params: {
  config: Config;
  projectRoot: string;
  getLanguageService(): ts.LanguageService;
  getLanguageServiceHost(): ts.LanguageServiceHost;
  system: ts.System;
  rootNames: readonly string[];
  options: ts.CompilerOptions;
}): PluginCreateInfo<Config> => {
  let languageServiceHost: ts.LanguageServiceHost | undefined;
  return {
    config: params.config,

    get languageService() {
      return params.getLanguageService();
    },

    get languageServiceHost() {
      return (
        languageServiceHost ||
        (languageServiceHost = createVirtualLanguageServiceHost(
          params.system,
          [...params.rootNames],
          params.options,
          ts
        ).languageServiceHost)
      );
    },

    // NOTE: this is an inexact and incomplete implementation
    project: {
      getProjectName: () => params.projectRoot,
      projectService: { logger: console } as any,
    } as PluginCreateInfo['project'],

    // NOTE: this is an inexact and incomplete implementation
    serverHost: {
      ...params.system,
      setImmediate,
      clearImmediate,
    } as PluginCreateInfo['serverHost'],
  };
};
