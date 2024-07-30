import ts from 'typescript';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { init } from '@0no-co/graphqlsp/api';

import { createFSBackedSystem, createVirtualCompilerHost } from './vendor/typescript-vfs';

import type { VirtualMap, Mapping } from './mapping';
import type { ProgramContainer } from './container';
import { SourceMappedFile } from './mapping';
import { buildContainer } from './container';
import { transform, transformExtensions } from './transformers';

export type VirtualExtension = (typeof transformExtensions)[number];

export interface ProgramFactoryParams {
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

export interface ProgramFactory {
  readonly projectPath: string;
  readonly projectDirectories: readonly string[];

  createSourceFile(params: SourceFileParams, scriptKind?: ts.ScriptKind): ts.SourceFile;
  createExternalFiles(exts?: readonly VirtualExtension[]): readonly ts.SourceFile[];

  addSourceFile(file: SourceFileParams | ts.SourceFile, addRootName?: boolean): this;
  addMappedFile(file: SourceFileParams | ts.SourceFile, params: MappedFileParams): this;

  addVirtualFiles(files: readonly ts.SourceFile[]): Promise<this>;

  build(): ProgramContainer;
}

/** Bumps the Error stack traces to a length of 100 for better debugging. */
const bumpStackTraceLimit = () => {
  if ('stackTraceLimit' in Error && Error.stackTraceLimit < 25) {
    Error.stackTraceLimit = 25;
  }
};

export const programFactory = (params: ProgramFactoryParams): ProgramFactory => {
  const vfsMap = new Map<string, string>();
  const virtualMap: VirtualMap = new Map();

  const system = createFSBackedSystem(vfsMap, params.rootPath, ts, resolveDefaultLibsPath(params));
  const config = resolveConfig(params, system);

  const rootNames = new Set(config.fileNames);
  const options = {
    ...ts.getDefaultCompilerOptions(),
    getDefaultLibFilePath: ts.getDefaultLibFilePath(config.options),
    ...config.options,
  };
  const host = createVirtualCompilerHost(system, options, ts);

  const factory: ProgramFactory = {
    get projectPath() {
      return params.rootPath;
    },

    get projectDirectories() {
      const directories = new Set([params.rootPath]);
      for (const rootName of rootNames) directories.add(path.dirname(rootName));
      return [...directories];
    },

    createSourceFile(params, scriptKind) {
      return ts.createSourceFile(
        params.fileId,
        typeof params.sourceText === 'object'
          ? params.sourceText.getText(0, params.sourceText.getLength())
          : params.sourceText,
        options.target || ts.ScriptTarget.ESNext,
        /*setParentNodes*/ true,
        scriptKind || (params.scriptKind != null ? params.scriptKind : ts.ScriptKind.TSX)
      );
    },

    createExternalFiles(exts: readonly VirtualExtension[] = transformExtensions) {
      const files: ts.SourceFile[] = [];
      const seen = new Set(rootNames);
      const directories = new Set([params.rootPath]);
      for (const rootName of rootNames) directories.add(path.dirname(rootName));
      for (const directory of directories) {
        for (const fileId of system.readDirectory(directory, exts, ['**/node_modules'])) {
          if (!seen.has(fileId)) {
            seen.add(fileId);
            const contents = system.readFile(fileId, 'utf8');
            if (contents) {
              files.push(
                factory.createSourceFile(
                  {
                    fileId,
                    sourceText: contents,
                  },
                  ts.ScriptKind.External
                )
              );
            }
          }
        }
      }
      return files;
    },

    addSourceFile(input, addRootName) {
      const sourceFile =
        'fileName' in input ? input : factory.createSourceFile(input, ts.ScriptKind.TSX);
      host.updateFile(sourceFile);
      if (addRootName) rootNames.add(sourceFile.fileName);
      return factory;
    },

    addMappedFile(input, params) {
      const sourceFile =
        'fileName' in input ? input : factory.createSourceFile(input, ts.ScriptKind.External);
      if (params.mappings.length) rootNames.delete(sourceFile.fileName);
      const sourceMappedFile = new SourceMappedFile(params.mappings, {
        sourceFile,
        sourceFileId: sourceFile.fileName,
        generatedFileId: params.fileId,
      });
      virtualMap.set(sourceMappedFile.sourceFileId, sourceMappedFile);
      virtualMap.set(sourceMappedFile.generatedFileId, sourceMappedFile);
      return factory;
    },

    async addVirtualFiles(sourceFiles) {
      for (const sourceFile of sourceFiles) {
        const virtualFileId = `${sourceFile.fileName}.ts`;
        const virtualCode = await transform(sourceFile);
        if (virtualCode) {
          factory
            .addSourceFile(
              {
                fileId: virtualFileId,
                sourceText: virtualCode.snapshot,
              },
              /*addRootName*/ true
            )
            .addMappedFile(sourceFile, {
              mappings: virtualCode.mappings,
              fileId: virtualFileId,
            });
        }
      }
      return factory;
    },

    build() {
      bumpStackTraceLimit();

      // NOTE: This is necessary for `@0no-co/graphqlsp/api` to use the right instance
      // of the typescript library
      init({ typescript: ts });

      return buildContainer({
        virtualMap,
        projectRoot: params.rootPath,
        compilerHost: host.compilerHost,
        rootNames: [...rootNames],
        options,
        system,
      });
    },
  };

  return factory;
};

const resolveDefaultLibsPath = (params: ProgramFactoryParams): string => {
  const target = ts.getDefaultLibFilePath({});
  if (!ts.sys.fileExists(target)) {
    const require = createRequire(params.configPath);
    const request = 'typescript/package.json';
    try {
      return path.dirname(
        require.resolve(request, {
          paths: [
            path.join(path.dirname(params.configPath), 'node_modules'),
            path.join(params.rootPath, 'node_modules'),
            ...(require.resolve.paths(request) || []),
          ],
        })
      );
    } catch (_error) {
      return path.resolve(params.rootPath, 'node_modules', 'typescript', 'lib');
    }
  } else {
    return path.dirname(target);
  }
};

const resolveConfig = (params: ProgramFactoryParams, system: ts.System): ts.ParsedCommandLine => {
  const text = system.readFile(params.configPath, 'utf8') || '{}';
  const parseResult = ts.parseConfigFileTextToJson(params.configPath, text);
  if (parseResult.error != null) throw new Error(parseResult.error.messageText.toString());
  const projectRoot = path.dirname(params.configPath);
  return ts.parseJsonConfigFileContent(
    parseResult.config,
    system,
    projectRoot,
    ts.getDefaultCompilerOptions(),
    params.configPath
  );
};
