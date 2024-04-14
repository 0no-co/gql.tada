import type { GraphQLSPConfig } from '@gql.tada/internal';
import type { Project } from 'ts-morph';

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
