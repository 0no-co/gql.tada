import type { GraphQLSPConfig } from '@gql.tada/internal';

import type { ProgramContainer } from './factory';
import type { TranslatePosition } from './virtualCode';

export const createPluginInfo = (
  container: ProgramContainer,
  config: GraphQLSPConfig,
  projectPath: string,
  getPosition?: TranslatePosition
): any => {
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
        return container.languageService.getReferencesAtPosition(filename, position);
      },
      getDefinitionAtPosition: (filename, position) => {
        if (getPosition) {
          const output = getPosition(filename, position);
          if (output && output.isVirtual) {
            filename = output.fileId;
            position = output.position;
          }
        }
        return container.languageService.getDefinitionAtPosition(filename, position);
      },
      getProgram: () => {
        const program = container.program;
        return {
          ...program,
          isSourceFileFromExternalLibrary(source) {
            if (getPosition) {
              const output = getPosition(source.fileName);
              if (output) return true;
            }
            return program.isSourceFileFromExternalLibrary(source);
          },
          getSourceFile: (filepath) => {
            if (getPosition) {
              const output = getPosition(filepath);
              if (output && output.isVirtual) filepath = output.fileId;
            }
            return program.getSourceFile(filepath);
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
