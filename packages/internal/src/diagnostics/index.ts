import { Project, ts } from 'ts-morph';
import init from '@0no-co/graphqlsp';
import path from 'path';
import fs from 'fs';

export async function check() {
  const project = new Project({
    tsConfigFilePath: './tsconfig.json',
  });

  const plugin = init({
    typescript: ts as any,
  });

  const languageService = project.getLanguageService();
  const createdPlugin = plugin.create({
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
  });

  const sourceFiles = project.getSourceFiles();

  const allDiagnostics: FormattedDisplayableDiagnostic[] = sourceFiles.flatMap((sourceFile) => {
    const diag = createdPlugin.getSemanticDiagnostics(sourceFile.getFilePath());
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
  printDiagnostics(allDiagnostics);
}

interface FormattedDisplayableDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  start: number;
  end: number;
  file: string | undefined;
}

function printDiagnostics(diagnostics: FormattedDisplayableDiagnostic[]) {
  return diagnostics;
}

check();
