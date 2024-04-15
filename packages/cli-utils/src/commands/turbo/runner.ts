import * as path from 'node:path';
import { Project, TypeFormatFlags, TypeFlags, ts } from 'ts-morph';
import type { GraphQLSPConfig, LoadConfigResult } from '@gql.tada/internal';

import { loadConfig, parseConfig } from '@gql.tada/internal';

import { createPluginInfo } from '../../ts/project';
import type { TTY } from '../../term';
import type { WriteTarget } from '../shared';
import { writeOutput } from '../shared';
import * as logger from './logger';

const PREAMBLE_IGNORE = ['/* eslint-disable */', '/* prettier-ignore */'].join('\n') + '\n';

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
  } else if (pluginConfig.tadaTurboLocation) {
    destination = path.resolve(
      path.dirname(configResult.configPath),
      pluginConfig.tadaTurboLocation
    );
  } else if (pluginConfig.tadaOutputLocation) {
    // TODO: Add a warning that prompts the user to set `tadaTurboLocation` in their configuration
    destination = path.resolve(
      path.dirname(configResult.configPath),
      pluginConfig.tadaOutputLocation,
      '..',
      'graphql-cache.d.ts'
    );
  } else {
    throw logger.errorMessage(
      'No output path was specified to write the output file to.\n' +
        logger.hint(
          `You have to either set ${logger.code('"tadaTurboLocation"')} in your configuration,\n` +
            `pass an ${logger.code('--output')} argument to this command,\n` +
            'or pipe this command to an output file.'
        )
    );
  }

  let contents: string;
  try {
    contents = createCache(
      await getGraphqlInvocationCache({
        rootPath: configResult.rootPath,
        configPath: configResult.configPath,
        pluginConfig,
      })
    );
  } catch (error) {
    throw logger.externalError('Could not generate turbo output', error);
  }

  try {
    await writeOutput(destination, contents);
  } catch (error) {
    throw logger.externalError('Something went wrong while writing the introspection file', error);
  }
}

function createCache(cache: Record<string, string>): string {
  let output = '';
  for (const key in cache) {
    if (output) output += '\n';
    output += `    ${key}:\n      ${cache[key]};`;
  }
  return (
    PREAMBLE_IGNORE +
    "import type { TadaDocumentNode, $tada } from 'gql.tada';\n\n" +
    "declare module 'gql.tada' {\n" +
    ' interface setupCache {\n' +
    output +
    '\n  }' +
    '\n}\n'
  );
}

interface CacheParams {
  rootPath: string;
  configPath: string;
  pluginConfig: GraphQLSPConfig;
}

async function getGraphqlInvocationCache(params: CacheParams): Promise<Record<string, string>> {
  const projectPath = path.dirname(params.configPath);
  const project = new Project({ tsConfigFilePath: params.configPath });

  const pluginCreateInfo = createPluginInfo(project, params.pluginConfig, projectPath);
  const typeChecker = project.getTypeChecker().compilerObject;

  // Filter source files by whether they're under the relevant root path
  const sourceFiles = project.getSourceFiles().filter((sourceFile) => {
    const filePath = path.resolve(projectPath, sourceFile.getFilePath());
    const relative = path.relative(params.rootPath, filePath);
    return !relative.startsWith('..');
  });

  return sourceFiles.reduce((acc, sourceFile) => {
    const tadaCallExpressions = findAllCallExpressions(sourceFile.compilerNode, pluginCreateInfo);
    return {
      ...acc,
      ...tadaCallExpressions.reduce((acc, callExpression) => {
        const returnType = typeChecker.getTypeAtLocation(callExpression);
        const argumentType = typeChecker.getTypeAtLocation(callExpression.arguments[0]);
        if (returnType.symbol.getEscapedName() !== 'TadaDocumentNode') {
          return acc; // TODO: we could collect this and warn if all extracted types have some kind of error
        }
        const keyString: string =
          'value' in argumentType &&
          typeof argumentType.value === 'string' &&
          (argumentType.flags & TypeFlags.StringLiteral) === 0
            ? JSON.stringify(argumentType.value)
            : typeChecker.typeToString(argumentType, callExpression, BUILDER_FLAGS);
        const valueString = typeChecker.typeToString(returnType, callExpression, BUILDER_FLAGS);
        acc[keyString] = valueString;
        return acc;
      }, {}),
    };
  }, {});
}

const BUILDER_FLAGS: TypeFormatFlags =
  TypeFormatFlags.NoTruncation |
  TypeFormatFlags.NoTypeReduction |
  TypeFormatFlags.InTypeAlias |
  TypeFormatFlags.UseFullyQualifiedType |
  TypeFormatFlags.GenerateNamesForShadowedTypeParams |
  TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
  TypeFormatFlags.AllowUniqueESSymbolType |
  TypeFormatFlags.WriteTypeArgumentsOfSignature;

function findAllCallExpressions(
  sourceFile: ts.SourceFile,
  info: ts.server.PluginCreateInfo
): Array<ts.CallExpression> {
  const result: Array<ts.CallExpression> = [];
  const templates = new Set([info.config.template, 'graphql', 'gql'].filter(Boolean));
  function find(node: ts.Node) {
    if (ts.isCallExpression(node) && templates.has(node.expression.getText())) {
      result.push(node);
      return;
    } else {
      ts.forEachChild(node, find);
    }
  }
  find(sourceFile);
  return result;
}
