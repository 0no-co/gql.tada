import type { GraphQLSPConfig } from '@gql.tada/internal';
import type { Project, SourceFile } from 'ts-morph';
import * as vue from '@vue/language-core';

const VUE_MAPPING = new Map<string, vue.SourceMap>();

export const polyfillVueSupport = (
  project: Project,
  ts: typeof import('typescript/lib/tsserverlibrary')
): readonly SourceFile[] => {
  const vueProjectFiles = project.addSourceFilesAtPaths(['!node_modules', './**/*.vue']);
  if (vueProjectFiles.length) {
    const vueOptions = vue.resolveVueCompilerOptions({});
    const compilerOptions = project.getCompilerOptions();
    const vueLanguagePlugin = vue.createVueLanguagePlugin(
      ts,
      (id) => id,
      true /* use case-sensitive filenames */,
      () => 'project-version-tsc' /* we don't need a version, no incremental going on */,
      () => vueProjectFiles.map((x) => x.compilerNode.fileName),
      compilerOptions,
      vueOptions,
      false
    );

    for (const sourceFile of vueProjectFiles) {
      const filename = sourceFile.compilerNode.fileName;
      const virtualCode = vueLanguagePlugin.createVirtualCode(
        filename,
        'vue',
        ts.ScriptSnapshot.fromString(sourceFile.getFullText())
      );

      if (!virtualCode) continue;

      const serviceScript = vueLanguagePlugin.typescript?.getServiceScript(virtualCode);
      if (serviceScript) {
        const parsedSourceFile = project.createSourceFile(
          filename + '.ts',
          serviceScript.code.snapshot.getText(0, serviceScript.code.snapshot.getLength()),
          { overwrite: true, scriptKind: serviceScript.scriptKind }
        );
        const sourcemap = new vue.SourceMap(serviceScript.code.mappings);
        VUE_MAPPING.set(parsedSourceFile.compilerNode.fileName, sourcemap);
        parsedSourceFile.version = sourceFile.version;
        parsedSourceFile._inProject = false;
      }
    }
  }
  return vueProjectFiles;
};

export const createPluginInfo = (
  project: Project,
  config: GraphQLSPConfig,
  projectName: string
): any => {
  const languageService = project.getLanguageService();
  return {
    config,
    languageService: {
      getReferencesAtPosition: (filename, position) => {
        if (filename.endsWith('.vue')) {
          filename += '.ts';
          if (VUE_MAPPING.has(filename)) {
            const sourcemap = VUE_MAPPING.get(filename);
            if (sourcemap) {
              const newPosition = sourcemap.getGeneratedOffset(position);
              if (newPosition) position = newPosition[0];
            }
          }
        }
        return languageService.compilerObject.getReferencesAtPosition(filename, position);
      },
      getDefinitionAtPosition: (filename, position) => {
        if (filename.endsWith('.vue')) {
          filename += '.ts';
          if (VUE_MAPPING.has(filename)) {
            const sourcemap = VUE_MAPPING.get(filename);
            if (sourcemap) {
              const newPosition = sourcemap.getGeneratedOffset(position);
              if (newPosition) position = newPosition[0];
            }
          }
        }
        const result = languageService.compilerObject.getDefinitionAtPosition(filename, position);
        return result;
      },
      getProgram: () => {
        const program = project.getProgram();
        return {
          ...program,
          isSourceFileFromExternalLibrary: (source) =>
            source.fileName.endsWith('.vue') ||
            program.isSourceFileFromExternalLibrary(source as any),
          getTypeChecker: () => project.getTypeChecker().compilerObject,
          getSourceFile: (s) => {
            const source = project.getSourceFile(s);
            return source && source.compilerNode;
          },
        };
      },
      // This prevents us from exposing normal diagnostics
      getSemanticDiagnostics: () => [],
    } as any,
    languageServiceHost: {} as any,
    project: {
      getProjectName: () => projectName,
      projectService: {
        logger: console,
      },
    } as any,
    serverHost: {} as any,
  };
};
