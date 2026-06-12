import * as path from 'node:path';
import type { GraphQLSPConfig, LoadConfigResult } from '@gql.tada/internal';
import { loadConfigs, parseConfig, validateUniqueOutputLocations } from '@gql.tada/internal';

export interface ProjectContext {
  configResult: LoadConfigResult;
  pluginConfig: GraphQLSPConfig;
  /** Directory of the project's own tsconfig.json file. */
  projectPath: string;
  /** Display name for per-project output. */
  label: string;
}

/** Loads all projects with a plugin config, including referenced projects. */
export const loadProjects = async (tsconfig: string | undefined): Promise<ProjectContext[]> => {
  const configResults = await loadConfigs(tsconfig);
  const projects = configResults.map((configResult): ProjectContext => {
    const projectPath = path.dirname(configResult.tsconfigPath);
    return {
      configResult,
      pluginConfig: parseConfig(configResult.pluginConfig, configResult.rootPath),
      projectPath,
      label: path.relative(process.cwd(), configResult.tsconfigPath) || configResult.tsconfigPath,
    };
  });
  validateUniqueOutputLocations(
    projects.map((project) => ({
      projectPath: project.projectPath,
      config: project.pluginConfig,
      label: project.label,
    }))
  );
  return projects;
};
