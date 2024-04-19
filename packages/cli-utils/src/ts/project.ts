import type { GraphQLSPConfig } from '@gql.tada/internal';
import type { Project, SourceFile } from 'ts-morph';
import * as vue from '@vue/language-core';
import { ts } from 'ts-morph';

export function scanVueFiles(project: Project, projectPath: string) {
  const fileHost = project.getFileSystem();
  const seenPaths = new Set();
  const vueFiles: SourceFile[] = [];
  function _scanVueFiles(dirpath: string) {
    if (!seenPaths.has(dirpath)) {
      seenPaths.add(dirpath);
      for (const dir of fileHost.readDirSync(dirpath)) {
        if (dir.isSymlink) {
          continue;
        } else if (dir.isFile && /\.vue$/.test(dir.name)) {
          const sourceFile = project.addSourceFileAtPath(dir.name);
          sourceFile._inProject = false;
          vueFiles.push(sourceFile);
        } else if (dir.isDirectory && !/\bnode_modules\b/.test(dir.name)) {
          _scanVueFiles(dir.name);
        }
      }
    }
  }
  _scanVueFiles(projectPath);
  for (const dir of project.getRootDirectories()) _scanVueFiles(dir.getPath());
  return vueFiles;
}

export const addVueFilesToProject = (
  project: Project,
  projectPath: string
): readonly SourceFile[] => {
  const vueProjectFiles = scanVueFiles(project, projectPath);
  const vueSourceFiles: SourceFile[] = [...vueProjectFiles];
  if (vueProjectFiles.length) {
    const vueOptions = vue.resolveVueCompilerOptions({});
    const compilerOptions = project.getCompilerOptions();
    const vueLanguagePlugin = vue.createVueLanguagePlugin(
      ts,
      (id) => id,
      true /* use case-sensitive filenames */,
      () => 'project-version-tsc' /* we don't need a version, no incremental going on */,
      () => vueProjectFiles.map((sourceFile) => sourceFile.compilerNode.fileName),
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
      const serviceScript = vueLanguagePlugin.typescript?.getServiceScript(virtualCode!);
      if (serviceScript) {
        const vueSourceFile = project.createSourceFile(
          filename + '.ts',
          serviceScript.code.snapshot.getText(0, serviceScript.code.snapshot.getLength()),
          { overwrite: true, scriptKind: serviceScript.scriptKind }
        );
        vueSourceFile.version = sourceFile.version;
        vueSourceFiles.push(vueSourceFile);
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
