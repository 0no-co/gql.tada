import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

import type { ProjectContext } from './projects';
import { code, errorMessage, hint } from './logger';

export type CompilerName = 'typescript' | 'tsrs';

export interface DetectCompilerParams {
  rootPath: string;
  tsconfigPath?: string;
  compiler?: CompilerName;
}

const resolvePackageJson = (name: string, fromPath: string): any | null => {
  try {
    const require = createRequire(path.join(fromPath, 'noop.js'));
    return JSON.parse(fs.readFileSync(require.resolve(`${name}/package.json`), 'utf8'));
  } catch {
    return null;
  }
};

/** Determines whether a project is checked on the TypeScript 7.1 API rather than with the compiler API.
 *
 * @remarks
 * TypeScript 7 doesn't expose the compiler API and doesn't load language service
 * plugins, so `@0no-co/graphqlsp`'s diagnostics are run on its programmatic API
 * instead. This is the case when `typescript@>=7` is installed, tsrs is requested,
 * or only tsrs is installed.
 */
export const detectCompiler = (params: DetectCompilerParams): CompilerName | null => {
  const fromPath = params.tsconfigPath ? path.dirname(params.tsconfigPath) : params.rootPath;
  if (params.compiler === 'tsrs') return 'tsrs';
  const typescript = resolvePackageJson('typescript', fromPath);
  if (typescript) {
    const major = parseInt(`${typescript.version}`.split('.')[0], 10);
    return major >= 7 ? 'typescript' : null;
  } else if (params.compiler !== 'typescript' && resolvePackageJson('tsrs', fromPath)) {
    return 'tsrs';
  }
  return null;
};

/** Throws when a project can't be loaded with the TypeScript compiler API, i.e. on TypeScript 7 or tsrs. */
export const assertCompilerAPI = (project: ProjectContext, command: string) => {
  const compiler = detectCompiler({
    rootPath: project.configResult.rootPath,
    tsconfigPath: project.configResult.tsconfigPath,
  });
  if (compiler) {
    throw errorMessage(
      `${code(`gql.tada ${command}`)} doesn't support ${compiler === 'tsrs' ? 'tsrs' : 'TypeScript 7'} yet.\n` +
        hint(
          `It needs the TypeScript compiler API, which TypeScript 7 doesn't expose.\n` +
            `Run it with TypeScript 5 or 6 installed. ${code('gql.tada check')} supports TypeScript 7.1 and tsrs.`
        )
    );
  }
};
