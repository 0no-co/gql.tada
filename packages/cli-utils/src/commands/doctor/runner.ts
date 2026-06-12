import type ts from 'typescript';
import path from 'node:path';

import type { LoadConfigResult } from '@gql.tada/internal';
import {
  loadRef,
  loadConfigs,
  parseConfig,
  validateUniqueOutputLocations,
} from '@gql.tada/internal';

import type { ComposeInput } from '../../term';
import type { ProjectContext } from '../shared';
import { MINIMUM_VERSIONS, semverComply } from '../../utils/semver';
import { programFactory } from '../../ts';
import { findGraphQLConfig } from './helpers/graphqlConfig';
import * as versions from './helpers/versions';
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

const enum Messages {
  TITLE = 'Doctor',
  DESCRIPTION = 'Detects problems with your setup',
  CHECK_TS_VERSION = 'Checking TypeScript version',
  CHECK_DEPENDENCIES = 'Checking installed dependencies',
  CHECK_TSCONFIG = 'Checking tsconfig.json',
  CHECK_EXTERNAL_FILES = 'Checking external files support',
  CHECK_VSCODE = 'Checking VSCode setup',
  CHECK_SCHEMA = 'Checking schema',
}

export async function* run(): AsyncIterable<ComposeInput> {
  yield logger.title(Messages.TITLE, Messages.DESCRIPTION);
  yield logger.runningTask(Messages.CHECK_TS_VERSION);
  await delay();

  // Check TypeScript version
  let packageJson: versions.PackageJson;
  try {
    packageJson = await versions.readPackageJson();
  } catch (_error) {
    yield logger.failedTask(Messages.CHECK_TS_VERSION);
    throw logger.errorMessage(
      `A ${logger.code('package.json')} file was not found in the current working directory.\n` +
        logger.hint('Try running the doctor command in your workspace folder.')
    );
  }

  const typeScriptVersion = await versions.getTypeScriptVersion(packageJson);
  if (!typeScriptVersion) {
    yield logger.failedTask(Messages.CHECK_TS_VERSION);
    throw logger.errorMessage(
      `A version of ${logger.code('typescript')} was not found in your dependencies.\n` +
        logger.hint(`Is ${logger.code('typescript')} installed in this package?`)
    );
  } else if (!semverComply(typeScriptVersion, MINIMUM_VERSIONS.typescript)) {
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

  const supportsEmbeddedLsp = semverComply(
    typeScriptVersion,
    MINIMUM_VERSIONS.typescript_embed_lsp
  );
  if (!supportsEmbeddedLsp) {
    const gqlspVersion = await versions.getGraphQLSPVersion(packageJson);
    if (!gqlspVersion) {
      yield logger.failedTask(Messages.CHECK_DEPENDENCIES);
      throw logger.errorMessage(
        `A version of ${logger.code('@0no-co/graphqlsp')} was not found in your dependencies.\n` +
          logger.hint(`Is ${logger.code('@0no-co/graphqlsp')} installed?`)
      );
    } else if (!semverComply(gqlspVersion, MINIMUM_VERSIONS.lsp)) {
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

  const gqlTadaVersion = await versions.getGqlTadaVersion(packageJson);
  if (!gqlTadaVersion) {
    yield logger.failedTask(Messages.CHECK_DEPENDENCIES);
    throw logger.errorMessage(
      `A version of ${logger.code('gql.tada')} was not found in your dependencies.\n` +
        logger.hint(`Is ${logger.code('gql.tada')} installed?`)
    );
  } else if (!semverComply(gqlTadaVersion, '1.0.0')) {
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

  let configResults: LoadConfigResult[];
  try {
    configResults = await loadConfigs();
  } catch (error) {
    yield logger.failedTask(Messages.CHECK_TSCONFIG);
    throw logger.externalError(
      `A ${logger.code('tsconfig.json')} file was not found in the current working directory.`,
      error
    );
  }

  const projects: ProjectContext[] = [];
  for (const configResult of configResults) {
    const label =
      path.relative(process.cwd(), configResult.tsconfigPath) || configResult.tsconfigPath;
    try {
      projects.push({
        configResult,
        pluginConfig: parseConfig(configResult.pluginConfig, configResult.rootPath),
        projectPath: path.dirname(configResult.tsconfigPath),
        label,
      });
    } catch (error) {
      yield logger.failedTask(Messages.CHECK_TSCONFIG);
      throw logger.externalError(
        `The plugin configuration for ${logger.code(
          supportsEmbeddedLsp ? '"gql.tada/ts-plugin"' : '"@0no-co/graphqlsp"'
        )} in ${logger.code(label)} seems to be invalid.`,
        error
      );
    }
  }

  try {
    validateUniqueOutputLocations(
      projects.map((project) => ({
        projectPath: project.projectPath,
        config: project.pluginConfig,
        label: project.label,
      }))
    );
  } catch (error) {
    yield logger.failedTask(Messages.CHECK_TSCONFIG);
    throw logger.externalError('The output locations of your configured projects overlap.', error);
  }

  yield logger.completedTask(Messages.CHECK_TSCONFIG);
  if (projects.length > 1) {
    yield logger.hintMessage(
      `Found ${projects.length} ${logger.code('gql.tada')} projects through ${logger.code(
        '"references"'
      )} in your ${logger.code('tsconfig.json')} files.\n`
    );
  }

  yield* runExternalFilesChecks(projects, packageJson);

  yield* runVSCodeChecks();

  yield logger.runningTask(Messages.CHECK_SCHEMA);
  await delay();

  for (const project of projects) {
    try {
      await loadRef(project.pluginConfig).load({ rootPath: project.projectPath });
    } catch (error) {
      yield logger.failedTask(Messages.CHECK_SCHEMA);
      throw logger.externalError(
        projects.length > 1
          ? `Failed to load schema for project ${logger.code(project.label)}.`
          : 'Failed to load schema.',
        error
      );
    }
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
      if (!userExtensions.includes('graphql.vscode-graphql-syntax')) {
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

async function* runExternalFilesChecks(
  projects: readonly ProjectContext[],
  packageJson: versions.PackageJson
): AsyncIterable<ComposeInput> {
  const externalFiles: ts.SourceFile[] = [];
  for (const project of projects) {
    try {
      const factory = programFactory({
        rootPath: project.configResult.rootPath,
        configPath: project.configResult.tsconfigPath,
      });
      externalFiles.push(...factory.createExternalFiles());
    } catch (_error) {
      // NOTE: If a project fails to load, we currently just ignore this check and move on
    }
  }

  if (externalFiles.length) {
    yield logger.runningTask(Messages.CHECK_EXTERNAL_FILES);
    await delay();

    const extensions = new Set(
      externalFiles.map((sourceFile) => path.extname(sourceFile.fileName))
    );

    if (extensions.has('.svelte') && !(await versions.hasSvelteSupport(packageJson))) {
      yield logger.failedTask(Messages.CHECK_EXTERNAL_FILES);
      throw logger.errorMessage(
        `A version of ${logger.code(
          '@gql.tada/svelte-support'
        )} must be installed for Svelte file support.\n` +
          logger.hint(`Have you installed ${logger.code('@gql.tada/svelte-support')}?`)
      );
    }

    if (extensions.has('.vue') && !(await versions.hasVueSupport(packageJson))) {
      yield logger.failedTask(Messages.CHECK_EXTERNAL_FILES);
      throw logger.errorMessage(
        `A version of ${logger.code(
          '@gql.tada/vue-support'
        )} must be installed for Vue file support.\n` +
          logger.hint(`Have you installed ${logger.code('@gql.tada/vue-support')}?`)
      );
    }

    yield logger.completedTask(Messages.CHECK_EXTERNAL_FILES);
  }
}
