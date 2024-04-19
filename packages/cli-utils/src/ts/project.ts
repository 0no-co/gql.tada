import type { GraphQLSPConfig } from '@gql.tada/internal';
import type { Project, Program } from 'ts-morph';
import * as vue from '@vue/language-core';

export const createPluginInfo = (
  project: Project,
  config: GraphQLSPConfig,
  projectName: string,
  ts?: typeof import('typescript/lib/tsserverlibrary')
): any => {
  const languageService = project.getLanguageService();
  // TODO: can be more elaborate
  const vueOptions = vue.resolveVueCompilerOptions({});
  const compilerOptions = project.getCompilerOptions();
  const vueLanguagePlugin = vue.createVueLanguagePlugin(
    ts!,
    (id) => id,
    // TODO: use case sensitive filenames
    false,
    () => '',
    // TODO: rootnames
    () => [],
    compilerOptions,
    vueOptions,
    false
  );

  return {
    config,
    languageService: {
      getReferencesAtPosition: (filename, position) => {
        if (filename.endsWith('.vue')) {
          const sourceFile = project.getSourceFile(filename);
          if (!sourceFile) return undefined;
          const virtualCode = vueLanguagePlugin.createVirtualCode(
            filename,
            'vue',
            ts!.ScriptSnapshot.fromString(sourceFile!.getFullText())
          );
          const serviceScript = vueLanguagePlugin.typescript?.getServiceScript(virtualCode!);
          if (!serviceScript) return undefined;
          const parsedSourceFile = project.createSourceFile(
            filename,
            serviceScript.code.snapshot.getText(0, serviceScript.code.snapshot.getLength()),
            { overwrite: true, scriptKind: serviceScript?.scriptKind || ts!.ScriptKind.TS }
          );
          // @ts-expect-error
          parsedSourceFile.version = sourceFile.version;
          return languageService.findReferencesAtPosition(parsedSourceFile, position);
        }
        return languageService.compilerObject.getReferencesAtPosition(filename, position);
      },
      getDefinitionAtPosition: (filename, position) => {
        if (filename.endsWith('.vue')) {
          const sourceFile = project.getSourceFile(filename);
          if (!sourceFile) return undefined;
          const virtualCode = vueLanguagePlugin.createVirtualCode(
            filename,
            'vue',
            ts!.ScriptSnapshot.fromString(sourceFile!.getFullText())
          );
          const serviceScript = vueLanguagePlugin.typescript?.getServiceScript(virtualCode!);
          if (!serviceScript) return undefined;
          const parsedSourceFile = project.createSourceFile(
            filename,
            serviceScript.code.snapshot.getText(0, serviceScript.code.snapshot.getLength()),
            { overwrite: true, scriptKind: serviceScript?.scriptKind || ts!.ScriptKind.TS }
          );
          // @ts-expect-error
          parsedSourceFile.version = sourceFile.version;
          return languageService.getDefinitionsAtPosition(parsedSourceFile, position);
        }
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
    languageServiceHost: {
      getScriptSnapshot: (fileName) => {
        // TODO: this can do much more fancy stuff normally
        const sourceFile = project.getSourceFile(fileName);
        return sourceFile ? ts!.ScriptSnapshot.fromString(sourceFile.getFullText()) : undefined;
      },
    } as any,
    project: {
      getProjectName: () => projectName,
      projectService: {
        logger: console,
      },
    } as any,
    serverHost: {} as any,
  };
};
