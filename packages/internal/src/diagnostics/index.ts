import { Project, ts } from 'ts-morph';
import { init, getGraphQLDiagnostics } from '@0no-co/graphqlsp/api';
import path from 'path';
import fs from 'fs';
import { resolveTypeScriptRootDir } from '../resolve';
import type { SchemaOrigin } from '../loaders';
import { load } from '../loaders';

type Severity = 'error' | 'warning' | 'info';
const severities: Severity[] = ['error', 'warning', 'info'];
interface FormattedDisplayableDiagnostic {
  severity: Severity;
  message: string;
  line: number;
  col: number;
  file: string | undefined;
}

type GraphQLSPConfig = {
  name: string;
  schema: SchemaOrigin;
  tadaOutputLocation: string;
};

export async function check(
  config: GraphQLSPConfig,
  minSeverity: Severity = 'error'
): Promise<FormattedDisplayableDiagnostic[]> {
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
  const loader = load({ origin: config.schema, rootPath });
  let schema;
  try {
    const loaderResult = await loader.load();
    schema = loaderResult && loaderResult.schema;
    if (!schema) {
      throw new Error(`Failed to load schema`);
    }
  } catch (error) {
    throw new Error(`Failed to load schema: ${error}`);
  }

  const allDiagnostics: FormattedDisplayableDiagnostic[] = sourceFiles
    .flatMap((sourceFile) => {
      const diag =
        getGraphQLDiagnostics(
          sourceFile.getFilePath(),
          { current: schema, version: 1 },
          pluginCreateInfo
        ) || [];
      return diag.map((diag) => {
        const text = diag.file && diag.file.getText();
        const start = diag.start;
        const [line, col] = getLineCol(text || '', start || 0);
        return {
          severity: (diag.category === ts.DiagnosticCategory.Error
            ? 'error'
            : diag.category === ts.DiagnosticCategory.Warning
              ? 'warning'
              : 'info') as Severity,
          message: diag.messageText as string,
          file: diag.file && diag.file.fileName,
          line,
          col,
        };
      });
    })
    // Filter out diagnostics below the minimum severity
    .filter((diag) => severities.indexOf(diag.severity) <= severities.indexOf(minSeverity));

  return allDiagnostics;
}

function getLineCol(text: string, start: number): [number, number] {
  if (!text || !start) return [0, 0];

  let counter = 0;
  const parts = text.split('\n');
  for (let i = 0; i <= parts.length; i++) {
    const line = parts[i];
    if (counter + line.length > start) {
      return [i + 1, start - counter];
    } else {
      counter = counter + (line.length + 1);
      continue;
    }
  }

  return [0, 0];
}
