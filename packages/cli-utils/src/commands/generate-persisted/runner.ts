import * as path from 'node:path';
import { Project, ts } from 'ts-morph';
import { print } from '@0no-co/graphql.web';
import type { GraphQLSPConfig, LoadConfigResult } from '@gql.tada/internal';

import {
  init,
  findAllPersistedCallExpressions,
  getDocumentReferenceFromTypeQuery,
  unrollTadaFragments,
} from '@0no-co/graphqlsp/api';

import { loadConfig, parseConfig } from '@gql.tada/internal';

import type { TTY } from '../../term';
import type { WriteTarget } from '../shared';
import { createPluginInfo } from '../../ts/project';
import { writeOutput } from '../shared';
import * as logger from './logger';

interface Options {
  tsconfig: string | undefined;
  output: string | undefined;
}

export async function* run(tty: TTY, opts: Options) {
  let configResult: LoadConfigResult;
  let pluginConfig: GraphQLSPConfig;
  try {
    configResult = await loadConfig(opts.tsconfig);
    pluginConfig = parseConfig(configResult.pluginConfig);
  } catch (error) {
    throw logger.externalError('Failed to load configuration.', error);
  }

  let destination: WriteTarget;
  if (!opts.output && tty.pipeTo) {
    destination = tty.pipeTo;
  } else if (opts.output) {
    destination = path.resolve(process.cwd(), opts.output);
  } else if (pluginConfig.tadaPersistedLocation) {
    destination = path.resolve(
      path.dirname(configResult.configPath),
      pluginConfig.tadaPersistedLocation
    );
  } else {
    throw logger.errorMessage(
      'No output path was specified to write the persisted manifest file to.\n' +
        logger.hint(
          `You have to either set ${logger.code(
            '"tadaPersistedLocation"'
          )} in your configuration,\n` +
            `pass an ${logger.code('--output')} argument to this command,\n` +
            'or pipe this command to an output file.'
        )
    );
  }

  let contents: string;
  try {
    const persistedOperations = await getPersistedOperationsFromFiles({
      rootPath: configResult.rootPath,
      configPath: configResult.configPath,
      pluginConfig,
    });
    contents = JSON.stringify(persistedOperations, null, 2);
  } catch (error) {
    throw logger.externalError('Could not generate persisted manifest file', error);
  }

  try {
    await writeOutput(destination, contents);
  } catch (error) {
    throw logger.externalError('Something went wrong while writing the introspection file', error);
  }
}

export interface PersistedParams {
  rootPath: string;
  configPath: string;
  pluginConfig: GraphQLSPConfig;
}

async function getPersistedOperationsFromFiles(
  params: PersistedParams
): Promise<Record<string, string>> {
  init({ typescript: ts as any });

  const projectPath = path.dirname(params.configPath);
  const project = new Project({ tsConfigFilePath: params.configPath });
  const pluginInfo = createPluginInfo(project, params.pluginConfig, projectPath);

  // Filter source files by whether they're under the relevant root path
  const sourceFiles = project.getSourceFiles().filter((sourceFile) => {
    const filePath = path.resolve(projectPath, sourceFile.getFilePath());
    const relative = path.relative(params.rootPath, filePath);
    return !relative.startsWith('..');
  });

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
          pluginInfo
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
          unrollTadaFragments(initializer.arguments[1], fragments, pluginInfo);
        }

        const document = `${operation}\n\n${fragments.map((frag) => print(frag)).join('\n\n')}`;
        acc[hash.slice(1, -1)] = document;
        return acc;
      }, {}),
    };
  }, {});
}
