import fs from 'node:fs/promises';
import path from 'node:path';
import semiver from 'semiver';

import type { GraphQLSPConfig, LoadConfigResult } from '@gql.tada/internal';
import { loadRef, loadConfig, parseConfig } from '@gql.tada/internal';

import type { ComposeInput } from '../../term';
import { findGraphQLConfig } from './helpers/graphqlConfig';
import * as vscode from './helpers/vscode';
import * as logger from './logger';

// NOTE: Currently, most tasks in this command complete too quickly
// We slow them down to make the CLI output easier to follow along to
const delay = (ms = 700) => {
  if (process.env.CI) {
    return Promise.resolve();
  } else {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
};

export const semiverComply = (version: string, compare: string) => {
  const match = version.match(/\d+\.\d+\.\d+/);
  return match ? semiver(match[0], compare) >= 0 : false;
};

const enum Messages {
  TITLE = 'Doctor',
  DESCRIPTION = 'Detects problems with your setup',
  CHECK_TS_VERSION = 'Checking TypeScript version',
  CHECK_DEPENDENCIES = 'Checking installed dependencies',
  CHECK_TSCONFIG = 'Checking tsconfig.json',
  CHECK_VSCODE = 'Checking VSCode setup',
  CHECK_SCHEMA = 'Checking schema',
}

export const MINIMUM_VERSIONS = {
  typescript_embed_lsp: '5.5.0',
  typescript: '4.1.0',
  tada: '1.0.0',
  lsp: '1.0.0',
};

export async function* run(): AsyncIterable<ComposeInput> {
  yield logger.title(Messages.TITLE, Messages.DESCRIPTION);
  yield logger.runningTask(Messages.CHECK_TS_VERSION);
  await delay();

  // Check TypeScript version
  const cwd = process.cwd();
  const packageJsonPath = path.resolve(cwd, 'package.json');
  let packageJsonContents: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  try {
    const file = path.resolve(packageJsonPath);
    packageJsonContents = JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch (_error) {
    yield logger.failedTask(Messages.CHECK_TS_VERSION);
    throw logger.errorMessage(
      `A ${logger.code('package.json')} file was not found in the current working directory.\n` +
        logger.hint('Try running the doctor command in your workspace folder.')
    );
  }

  const deps = Object.entries({
    ...packageJsonContents.dependencies,
    ...packageJsonContents.devDependencies,
  });

  const typeScriptVersion = deps.find((x) => x[0] === 'typescript');
  if (!typeScriptVersion) {
    yield logger.failedTask(Messages.CHECK_TS_VERSION);
    throw logger.errorMessage(
      `A version of ${logger.code('typescript')} was not found in your dependencies.\n` +
        logger.hint(`Is ${logger.code('typescript')} installed in this package?`)
    );
  } else if (!semiverComply(typeScriptVersion[1], MINIMUM_VERSIONS.typescript)) {
    // TypeScript version lower than v4.1 which is when they introduced template lits
    yield logger.failedTask(Messages.CHECK_TS_VERSION);
    throw logger.errorMessage(
      `The version of ${logger.code('typescript')} in your dependencies is out of date.\n` +
        logger.hint(
          `${logger.code('gql.tada')} requires at least ${logger.bold(MINIMUM_VERSIONS.typescript)}`
        )
    );
  }

  yield logger.completedTask(Messages.CHECK_TS_VERSION);
  yield logger.runningTask(Messages.CHECK_DEPENDENCIES);
  await delay();

  const supportsEmbeddedLsp = semiverComply(
    typeScriptVersion[1],
    MINIMUM_VERSIONS.typescript_embed_lsp
  );
  if (!supportsEmbeddedLsp) {
    const gqlspVersion = deps.find((x) => x[0] === '@0no-co/graphqlsp');
    if (!gqlspVersion) {
      yield logger.failedTask(Messages.CHECK_DEPENDENCIES);
      throw logger.errorMessage(
        `A version of ${logger.code('@0no-co/graphqlsp')} was not found in your dependencies.\n` +
          logger.hint(`Is ${logger.code('@0no-co/graphqlsp')} installed?`)
      );
    } else if (!semiverComply(gqlspVersion[1], MINIMUM_VERSIONS.lsp)) {
      yield logger.failedTask(Messages.CHECK_DEPENDENCIES);
      throw logger.errorMessage(
        `The version of ${logger.code(
          '@0no-co/graphqlsp'
        )} in your dependencies is out of date.\n` +
          logger.hint(
            `${logger.code('gql.tada')} requires at least ${logger.bold(MINIMUM_VERSIONS.lsp)}`
          )
      );
    }
  }

  const gqlTadaVersion = deps.find((x) => x[0] === 'gql.tada');
  if (!gqlTadaVersion) {
    yield logger.failedTask(Messages.CHECK_DEPENDENCIES);
    throw logger.errorMessage(
      `A version of ${logger.code('gql.tada')} was not found in your dependencies.\n` +
        logger.hint(`Is ${logger.code('gql.tada')} installed?`)
    );
  } else if (!semiverComply(gqlTadaVersion[1], '1.0.0')) {
    yield logger.failedTask(Messages.CHECK_DEPENDENCIES);
    throw logger.errorMessage(
      `The version of ${logger.code('gql.tada')} in your dependencies is out of date.\n` +
        logger.hint(
          `It's recommended to upgrade ${logger.code('gql.tada')} to at least ${logger.bold(
            MINIMUM_VERSIONS.lsp
          )}`
        )
    );
  }

  yield logger.completedTask(Messages.CHECK_DEPENDENCIES);
  yield logger.runningTask(Messages.CHECK_TSCONFIG);
  await delay();

  let configResult: LoadConfigResult;
  try {
    configResult = await loadConfig();
  } catch (error) {
    yield logger.failedTask(Messages.CHECK_TSCONFIG);
    throw logger.externalError(
      `A ${logger.code('tsconfig.json')} file was not found in the current working directory.`,
      error
    );
  }

  let pluginConfig: GraphQLSPConfig;
  try {
    pluginConfig = parseConfig(configResult.pluginConfig, configResult.rootPath);
  } catch (error) {
    yield logger.failedTask(Messages.CHECK_TSCONFIG);
    throw logger.externalError(
      `The plugin configuration for ${logger.code(
        supportsEmbeddedLsp ? '"gql.tada/ts-plugin"' : '"@0no-co/graphqlsp"'
      )} seems to be invalid.`,
      error
    );
  }

  yield logger.completedTask(Messages.CHECK_TSCONFIG);

  yield* runVSCodeChecks();

  yield logger.runningTask(Messages.CHECK_SCHEMA);
  await delay();

  try {
    await loadRef(pluginConfig).load({ rootPath: path.dirname(configResult.configPath) });
  } catch (error) {
    yield logger.failedTask(Messages.CHECK_SCHEMA);
    throw logger.externalError('Failed to load schema.', error);
  }

  yield logger.completedTask(Messages.CHECK_SCHEMA, true);
  await delay();

  yield logger.success();
}

async function* runVSCodeChecks(): AsyncIterable<ComposeInput> {
  const suggestedExtensions = await vscode.loadSuggestedExtensionsList();
  const isVSCodeInstalled = await vscode.isVSCodeInstalled();
  if (suggestedExtensions.length || isVSCodeInstalled) {
    yield logger.runningTask(Messages.CHECK_VSCODE);
    await delay();

    let hasEndedTask = false;
    let userExtensions: readonly string[] = [];
    if (isVSCodeInstalled) {
      userExtensions = await vscode.loadExtensionsList();
      if (true || !userExtensions.includes('graphql.vscode-graphql-syntax')) {
        if (!hasEndedTask) {
          hasEndedTask = true;
          yield logger.warningTask(Messages.CHECK_VSCODE);
        }
        yield logger.hintMessage(
          `We recommend you to install the ${logger.code(
            '"GraphQL: Syntax Highlighting"'
          )} extension for VSCode.\n` +
            'See: https://marketplace.visualstudio.com/items?itemName=GraphQL.vscode-graphql-syntax\n'
        );
      }
    }

    const hasProblemExtension =
      userExtensions.includes('graphql.vscode-graphql') ||
      suggestedExtensions.includes('graphql.vscode-graphql');
    const graphqlConfig = await findGraphQLConfig();
    if (hasProblemExtension && !!graphqlConfig) {
      if (!hasEndedTask) {
        hasEndedTask = true;
        yield logger.warningTask(Messages.CHECK_VSCODE);
      }
      const fileName = path.basename(graphqlConfig);
      yield logger.hintMessage(
        `The ${logger.code(
          '"GraphQL: Language Feature Support"'
        )} VSCode extension can cause problems!\n` +
          `When enabled it may display invalid diagnostic errors for ${logger.code(
            'gql.tada'
          )} code.\n` +
          `Check whether your ${logger.code(fileName)} config only targets ${logger.code(
            '.graphql'
          )} documents.\n`
      );
    }

    if (!hasEndedTask) {
      yield logger.completedTask(Messages.CHECK_VSCODE);
    }
  }
}
