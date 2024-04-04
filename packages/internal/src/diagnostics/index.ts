import { Project, ts } from 'ts-morph';
import { init, getGraphQLDiagnostics } from '@0no-co/graphqlsp/api';
import path from 'path';
import fs from 'fs';
import { resolveTypeScriptRootDir } from '../resolve';
import { load } from '../loaders';

// TODO: introduce severity filter
export async function check(): Promise<FormattedDisplayableDiagnostic[]> {
  const projectName = path.resolve(process.cwd(), 'tsconfig.json');

  const project = new Project({
    tsConfigFilePath: './tsconfig.json',
  });

  const rootPath = (await resolveTypeScriptRootDir(projectName)) || path.dirname(projectName);

  init({
    typescript: ts as any,
  });

  const languageService = project.getLanguageService();
  const pluginCreateInfo = {
    // TODO: add in config
    config: {
      schema: './schema.graphql',
    },
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
      getProjectName: () => path.resolve(process.cwd(), 'tsconfig.json'),
      readFile: (p) => {
        return fs.readFileSync(p);
      },
      projectService: {
        logger: console,
      },
    } as any,
    serverHost: {} as any,
  };

  const sourceFiles = project.getSourceFiles();
  const loader = load({ origin, rootPath });
  let schema;
  try {
    const loaderResult = await loader.load();
    schema = loaderResult && loaderResult.schema;
    if (!schema) {
      console.error(`Failed to load schema`);
      return [];
    }
  } catch (error) {
    console.error(`Failed to load schema: ${error}`);
    return [];
  }

  const allDiagnostics: FormattedDisplayableDiagnostic[] = sourceFiles.flatMap((sourceFile) => {
    const diag =
      getGraphQLDiagnostics(
        sourceFile.getFilePath(),
        { current: schema, version: 1 },
        pluginCreateInfo
      ) || [];
    return diag.map((diag) => ({
      severity:
        diag.category === ts.DiagnosticCategory.Error
          ? 'error'
          : diag.category === ts.DiagnosticCategory.Warning
            ? 'warning'
            : 'info',
      message: diag.messageText as string,
      start: diag.start || 0,
      end: (diag.start || 0) + (diag.length || 0),
      file: diag.file && diag.file.fileName,
    }));
  });

  return allDiagnostics;
}

interface FormattedDisplayableDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  start: number;
  end: number;
  file: string | undefined;
}
