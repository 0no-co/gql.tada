import type { GraphQLSPConfig } from '@gql.tada/internal';
import type { Project } from 'ts-morph';

import type { TranslatePosition } from './virtualCode';

export const createPluginInfo = (
  project: Project,
  config: GraphQLSPConfig,
  projectPath: string,
  getPosition?: TranslatePosition
): any => {
  const languageService = project.getLanguageService();
  return {
    config,
    languageService: {
      getReferencesAtPosition: (filename, position) => {
        if (getPosition) {
          const output = getPosition(filename, position);
          if (output && output.isVirtual) {
            filename = output.fileId;
            position = output.position;
          }
        }
        return languageService.compilerObject.getReferencesAtPosition(filename, position);
      },
      getDefinitionAtPosition: (filename, position) => {
        if (getPosition) {
          const output = getPosition(filename, position);
          if (output && output.isVirtual) {
            filename = output.fileId;
            position = output.position;
          }
        }
        return languageService.compilerObject.getDefinitionAtPosition(filename, position);
      },
      getProgram: () => {
        const program = project.getProgram();
        return {
          ...program,
          isSourceFileFromExternalLibrary(source) {
            if (getPosition) {
              const output = getPosition(source.fileName);
              if (output) return true;
            }
            return program.isSourceFileFromExternalLibrary(source);
          },
          getTypeChecker: () => project.getTypeChecker().compilerObject,
          getSourceFile: (filepath) => {
            if (getPosition) {
              const output = getPosition(filepath);
              if (output && output.isVirtual) filepath = output.fileId;
            }
            const source = project.getSourceFile(filepath);
            return source && source.compilerNode;
          },
        };
      },
      // This prevents us from exposing normal diagnostics
      getSemanticDiagnostics: () => [],
    } as any,
    languageServiceHost: {} as any,
    project: {
      getProjectName: () => projectPath,
      projectService: {
        logger: console,
      },
    } as any,
    serverHost: {} as any,
  };
};
