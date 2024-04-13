import { Project, ts } from 'ts-morph';
import { print } from '@0no-co/graphql.web';

import {
  init,
  findAllPersistedCallExpressions,
  getDocumentReferenceFromTypeQuery,
  unrollTadaFragments,
} from '@0no-co/graphqlsp/api';

import { load, resolveTypeScriptRootDir } from '@gql.tada/internal';
import path from 'node:path';
import fs from 'node:fs/promises';

import type { TTY } from '../../term';
import type { GraphQLSPConfig } from '../../lsp';
import { getGraphQLSPConfig } from '../../lsp';
import { getTsConfig } from '../../tsconfig';
import { createPluginInfo } from '../../ts/project';

interface Options {
  tsconfig: string | undefined;
  output: string | undefined;
}

export async function run(tty: TTY, opts: Options) {
  const tsconfig = await getTsConfig(opts.tsconfig);
  if (!tsconfig) {
    return;
  }

  const config = getGraphQLSPConfig(tsconfig);
  if (!config) {
    return;
  }

  const persistedOperations = await getPersistedOperationsFromFiles(opts, config);
  const json = JSON.stringify(persistedOperations, null, 2);
  if (opts.output) {
    const resolved = path.resolve(process.cwd(), opts.output);
    await fs.writeFile(resolved, json);
  } else {
    const stream = tty.pipeTo || process.stdout;
    stream.write(json);
  }
}

const CWD = process.cwd();

async function getPersistedOperationsFromFiles(
  opts: Options,
  config: GraphQLSPConfig
): Promise<Record<string, string>> {
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

  return sourceFiles.reduce((acc, sourceFile) => {
    const persistedCallExpressions = findAllPersistedCallExpressions(sourceFile.compilerNode);
    const currentFilename = sourceFile.compilerNode.fileName;
    return {
      ...acc,
      ...persistedCallExpressions.reduce((acc, callExpression) => {
        const hash = callExpression.arguments[0].getText();
        if (!callExpression.typeArguments) {
          console.warn(
            `Persisted call expression in "${currentFilename}" is missing a type argument like "graphql.persisted<typeof document>". Skipping...`
          );
          return acc;
        }
        const [typeQuery] = callExpression.typeArguments;
        if (!ts.isTypeQueryNode(typeQuery)) {
          console.warn(
            `Persisted call expression in "${currentFilename}" is missing a type argument like "graphql.persisted<typeof document>". Skipping...`
          );
          return acc;
        }

        const { node: foundNode } = getDocumentReferenceFromTypeQuery(
          typeQuery,
          currentFilename,
          pluginCreateInfo
        );

        if (!foundNode) {
          console.warn(
            `Could not find reference for "${typeQuery.getText()}" in "${currentFilename}", if this is unexpected file an issue at "https://github.com/0no-co/gql.tada/issues/new/choose" describing your case.`
          );
          return acc;
        }

        const initializer = foundNode.initializer;
        if (
          !initializer ||
          !ts.isCallExpression(initializer) ||
          (!ts.isNoSubstitutionTemplateLiteral(initializer.arguments[0]) &&
            !ts.isStringLiteral(initializer.arguments[0]))
        ) {
          console.warn(
            `Persisted call expression in "${currentFilename}" is missing a string argument containing the hash. Skipping...`
          );
          return acc;
        }

        const fragments = [];
        const operation = initializer.arguments[0].getText().slice(1, -1);
        if (initializer.arguments[1] && ts.isArrayLiteralExpression(initializer.arguments[1])) {
          unrollTadaFragments(initializer.arguments[1], fragments, pluginCreateInfo);
        }

        const document = `${operation}\n\n${fragments.map((frag) => print(frag)).join('\n\n')}`;
        acc[hash.slice(1, -1)] = document;
        return acc;
      }, {}),
    };
  }, {});
}
