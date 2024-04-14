import { Project, ts } from 'ts-morph';
import { init, getGraphQLDiagnostics } from '@0no-co/graphqlsp/api';
import { load, resolveTypeScriptRootDir } from '@gql.tada/internal';
import path from 'node:path';

import type { GraphQLSPConfig } from '../../lsp';
import { getGraphQLSPConfig } from '../../lsp';
import { getTsConfig } from '../../tsconfig';
import { createPluginInfo } from '../../ts/project';

type Severity = 'error' | 'warn' | 'info';
const severities: Severity[] = ['error', 'warn', 'info'];

export interface FormattedDisplayableDiagnostic {
  severity: Severity;
  message: string;
  line: number;
  col: number;
  file: string | undefined;
}

export interface Options {
  failOnWarn: boolean | undefined;
  minSeverity: Severity;
  tsconfig: string | undefined;
}

export async function run(opts: Options) {
  const tsconfig = await getTsConfig(opts.tsconfig);
  if (!tsconfig) {
    return;
  }

  const config = getGraphQLSPConfig(tsconfig);
  if (!config) {
    return;
  }

  const result = await runDiagnostics(opts, config);
  const errorDiagnostics = result.filter((d) => d.severity === 'error');
  const warnDiagnostics = result.filter((d) => d.severity === 'warn');
  const infoDiagnostics = result.filter((d) => d.severity === 'info');

  const minSeverityForReport = severities.indexOf(opts.minSeverity);
  if (
    errorDiagnostics.length === 0 &&
    warnDiagnostics.length === 0 &&
    infoDiagnostics.length === 0
  ) {
    // eslint-disable-next-line no-console
    console.log('No issues found! 🎉');
    process.exit(0);
  } else {
    // TODO: report a summary at the top and then a list of files with diagnostics sorted by severity.
    const errorReport = errorDiagnostics.length
      ? `Found ${errorDiagnostics.length} Errors:\n${constructDiagnosticsPerFile(errorDiagnostics)}`
      : ``;
    const warningsReport =
      minSeverityForReport >= severities.indexOf('warn') && warnDiagnostics.length
        ? `Found ${warnDiagnostics.length} Warnings:\n${constructDiagnosticsPerFile(
            warnDiagnostics
          )}`
        : ``;
    const suggestionsReport =
      minSeverityForReport >= severities.indexOf('info') &&
      infoDiagnostics.length &&
      warnDiagnostics.length &&
      errorDiagnostics.length
        ? `Found ${infoDiagnostics.length} Suggestions:\n${constructDiagnosticsPerFile(
            infoDiagnostics
          )}`
        : ``;
    // eslint-disable-next-line no-console
    console.log(`${errorReport}${warningsReport}${suggestionsReport}`);
    if (errorDiagnostics.length || (opts.failOnWarn && warnDiagnostics.length)) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

const CWD = process.cwd();

async function runDiagnostics(
  opts: Options,
  config: GraphQLSPConfig
): Promise<FormattedDisplayableDiagnostic[]> {
  let tsconfigPath = opts.tsconfig || CWD;
  tsconfigPath =
    path.extname(tsconfigPath) !== '.json'
      ? path.resolve(CWD, tsconfigPath, 'tsconfig.json')
      : path.resolve(CWD, tsconfigPath);

  const projectPath = path.dirname(tsconfigPath);
  const rootPath = (await resolveTypeScriptRootDir(tsconfigPath)) || tsconfigPath;
  const project = new Project({
    tsConfigFilePath: tsconfigPath,
  });

  init({
    typescript: ts as any,
  });

  const pluginCreateInfo = createPluginInfo(project, config, projectPath);

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

  return sourceFiles.flatMap<FormattedDisplayableDiagnostic>((sourceFile) => {
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
            ? 'warn'
            : 'info') as Severity,
        message: diag.messageText as string,
        file: diag.file && diag.file.fileName,
        line,
        col,
      };
    });
  });
}

function getLineCol(text: string, start: number): [number, number] {
  if (!text || !start) return [0, 0];

  let counter = 0;
  const parts = text.split('\n');
  for (let i = 0; i <= parts.length; i++) {
    const line = parts[i];
    if (counter + line.length > start) {
      return [i + 1, start + 1 - counter];
    } else {
      counter = counter + (line.length + 1);
      continue;
    }
  }

  return [0, 0];
}

function constructDiagnosticsPerFile(diagnostics: FormattedDisplayableDiagnostic[]): string {
  const diagnosticsByFile = diagnostics.reduce<Record<string, string[]>>((acc, diag) => {
    const file = diag.file || '';
    if (!acc[file]) {
      acc[file] = [];
    }
    acc[file].push(`[${diag.line}:${diag.col}] ${diag.message}`);
    return acc;
  }, {});

  return Object.entries(diagnosticsByFile).reduce((acc, [fileName, diagnostics]) => {
    return `${acc}\n${fileName}\n${diagnostics.join('\n')}\n`;
  }, '');
}
