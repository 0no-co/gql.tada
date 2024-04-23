import ts from 'typescript';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { SourceMap } from '@volar/source-map';

import type { Mapping } from '@volar/source-map';

import {
  createFSBackedSystem,
  createVirtualCompilerHost,
  createVirtualTypeScriptEnvironment,
} from '@typescript/vfs';

export interface Params {
  rootPath: string;
  configPath: string;
}

export interface SourceFileParams {
  fileId: string;
  sourceText: string | ts.IScriptSnapshot;
  scriptKind?: ts.ScriptKind;
}

export interface MappedFileParams {
  fileId: string;
  mappings: readonly Mapping[];
}

export interface ProgramContainer {
  readonly program: ts.Program;
  readonly languageService: ts.LanguageService;

  getSourceFiles(): ts.SourceFile[];
  getSourceFile(fileId: string): ts.SourceFile | undefined;
}

export interface SourceFileMapping {
  sourceFileId: string;
  generatedFileId: string;
  sourceMap: SourceMap;
}

export interface ProgramFactory {
  readonly projectPath: string;
  readonly projectDirectories: readonly string[];

  createSourceFile(params: SourceFileParams, scriptKind?: ts.ScriptKind): ts.SourceFile;
  addSourceFile(file: SourceFileParams | ts.SourceFile, addRootName?: boolean): this;
  addMappedFile(file: SourceFileParams | ts.SourceFile, params: MappedFileParams): this;

  build(): ProgramContainer;
}

export const programFactory = (params: Params): ProgramFactory => {
  const vfsMap = new Map<string, string>();
  const virtualMap = new Map<string, SourceFileMapping>();

  const projectRoot = path.dirname(params.configPath);
  const tslibPath = path.join(projectRoot, 'node_modules/typescript/lib/');
  const system = createFSBackedSystem(vfsMap, projectRoot, ts, tslibPath);
  const config = resolveConfig(params, system);

  for (const { filename, contents } of resolveLibs(params))
    if (contents) system.writeFile(path.join(tslibPath, filename), contents);

  const rootNames = new Set(config.fileNames);
  const options = { ...defaultCompilerOptions, ...config.options };
  const host = createVirtualCompilerHost(system, options, ts);

  return {
    get projectPath() {
      return projectRoot;
    },

    get projectDirectories() {
      const directories = new Set([projectRoot]);
      for (const rootName of rootNames) directories.add(path.dirname(rootName));
      return [...directories];
    },

    createSourceFile(params, scriptKind) {
      return ts.createSourceFile(
        params.fileId,
        typeof params.sourceText === 'object'
          ? params.sourceText.getText(0, params.sourceText.getLength())
          : params.sourceText,
        options.target,
        /*setParentNodes*/ true,
        scriptKind || (params.scriptKind != null ? params.scriptKind : ts.ScriptKind.TSX)
      );
    },

    addSourceFile(input, addRootName) {
      const sourceFile =
        'fileName' in input ? input : this.createSourceFile(input, ts.ScriptKind.TSX);
      const result = host.updateFile(sourceFile);
      if (result && addRootName) rootNames.add(sourceFile.fileName);
      return this;
    },

    addMappedFile(input, params) {
      const sourceFile =
        'fileName' in input ? input : this.createSourceFile(input, ts.ScriptKind.External);
      if (params.mappings.length) rootNames.delete(sourceFile.fileName);
      const sourceFileMapping: SourceFileMapping = {
        sourceFileId: sourceFile.fileName,
        generatedFileId: params.fileId,
        sourceMap: new SourceMap(params.mappings as Mapping[]),
      };
      virtualMap.set(sourceFileMapping.sourceFileId, sourceFileMapping);
      virtualMap.set(sourceFileMapping.generatedFileId, sourceFileMapping);
      return this;
    },

    build() {
      let program: ts.Program | undefined;
      let service: ts.LanguageService | undefined;

      return {
        getSourceFiles() {
          const sourceFiles: ts.SourceFile[] = [];
          for (const sourceFile of this.program.getSourceFiles()) {
            const relativePath = path.relative(projectRoot, sourceFile.fileName);
            if (!relativePath.startsWith('..')) sourceFiles.push(sourceFile);
          }
          return sourceFiles;
        },
        getSourceFile(fileId: string) {
          return this.program.getSourceFile(fileId);
        },

        get program() {
          return (
            program ||
            (program = ts.createProgram({
              rootNames: [...rootNames],
              options: options,
              host: host.compilerHost,
            }))
          );
        },
        get languageService() {
          return (
            service ||
            (service = createVirtualTypeScriptEnvironment(
              system,
              [...rootNames],
              ts,
              options
            ).languageService)
          );
        },
      };
    },
  };
};

interface LibFile {
  filename: string;
  contents: string | undefined;
}

const defaultCompilerOptions = {
  target: ts.ScriptTarget.Latest,
} satisfies ts.CompilerOptions;

const resolveLibs = (params: Params): readonly LibFile[] => {
  const require = createRequire(params.configPath);
  const request = 'typescript/package.json';
  const tsPath = path.dirname(
    require.resolve(request, {
      paths: [
        path.join(path.dirname(params.configPath), 'node_modules'),
        path.join(params.rootPath, 'node_modules'),
        ...(require.resolve.paths(request) || []),
      ],
    })
  );
  const libs = ts.sys.readDirectory(
    path.resolve(tsPath, 'lib'),
    /*extensions*/ ['.d.ts'],
    /*include*/ undefined,
    /*exclude*/ ['typescript.d.ts']
  );
  return libs
    .filter((name) => /^lib/.test(name))
    .map(
      (name): LibFile => ({
        filename: name,
        contents: ts.sys.readFile(path.join(tsPath, 'lib', name), 'utf8'),
      })
    );
};

const resolveConfig = (params: Params, system: ts.System): ts.ParsedCommandLine => {
  const text = system.readFile(params.configPath, 'utf8') || '{}';
  const parseResult = ts.parseConfigFileTextToJson(params.configPath, text);
  if (parseResult.error != null) throw new Error(parseResult.error.messageText.toString());
  const projectRoot = path.dirname(params.configPath);
  return ts.parseJsonConfigFileContent(
    parseResult.config,
    system,
    projectRoot,
    defaultCompilerOptions,
    params.configPath
  );
};
