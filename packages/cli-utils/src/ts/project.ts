import type { GraphQLSPConfig } from '@gql.tada/internal';
import type { Project, SourceFile } from 'ts-morph';
import * as vue from '@vue/language-core';

export const polyfillVueSupport = async (
  project: Project,
  ts: typeof import('typescript/lib/tsserverlibrary')
): Promise<Array<SourceFile>> => {
  // TODO: scope this to the include array
  const vueProjectFiles = project.addSourceFilesAtPaths('./src/**/*.vue');
  if (vueProjectFiles.length) {
    // TODO: log experimental warning here
    const vueOptions = vue.resolveVueCompilerOptions({});
    const compilerOptions = project.getCompilerOptions();
    const vueLanguagePlugin = vue.createVueLanguagePlugin(
      ts as any,
      (id) => id,
      // use case sensitive filenames
      true,
      () => 'project-version-tsc', // we don't need a version, no incremental going on
      () => vueProjectFiles.map((x) => x.compilerNode.fileName),
      compilerOptions,
      vueOptions,
      false
    );
    vueProjectFiles.forEach((sourceFile) => {
      const filename = sourceFile.compilerNode.fileName;
      const virtualCode = vueLanguagePlugin.createVirtualCode(
        filename,
        'vue',
        ts!.ScriptSnapshot.fromString(sourceFile!.getFullText())
      );
      const serviceScript = vueLanguagePlugin.typescript?.getServiceScript(virtualCode!);
      if (!serviceScript) return undefined;
      const parsedSourceFile = project.createSourceFile(
        filename + '.ts',
        serviceScript.code.snapshot.getText(0, serviceScript.code.snapshot.getLength()),
        { overwrite: true, scriptKind: serviceScript.scriptKind }
      );
      // @ts-expect-error
      parsedSourceFile.version = sourceFile.version;
    });
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
        return languageService.compilerObject.getReferencesAtPosition(filename, position);
      },
      getDefinitionAtPosition: (filename, position) => {
        return languageService.compilerObject.getDefinitionAtPosition(filename, position);
      },
      getProgram: () => {
        const program = project.getProgram();
        return {
          ...program,
          isSourceFileFromExternalLibrary: (source) =>
            source.fileName.endsWith('.vue') ||
            program.isSourceFileFromExternalLibrary(source as any),
          getTypeChecker: () => project.getTypeChecker(),
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
