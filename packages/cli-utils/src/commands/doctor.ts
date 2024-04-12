import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'json5';
import semiver from 'semiver';
import type { TsConfigJson } from 'type-fest';
import { resolveTypeScriptRootDir } from '@gql.tada/internal';
import { existsSync } from 'node:fs';

import { getGraphQLSPConfig } from '../lsp';
import { initTTY } from '../term';
import * as logger from '../loggers/check';

const delay = (ms = 700) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const enum Messages {
  TITLE = 'Doctor',
  DESCRIPTION = 'Detects problems with your setup',
  CHECK_TS_VERSION = 'Checking TypeScript version',
  CHECK_DEPENDENCIES = 'Checking installed dependencies',
  CHECK_TSCONFIG = 'Checking tsconfig.json',
}

const MINIMUM_VERSIONS = {
  typescript: '4.1.0',
  tada: '1.0.0',
  lsp: '1.0.0',
};

export async function executeTadaDoctor() {
  await initTTY().start(run());
}

async function* run() {
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
      'Failed to read package.json in current working directory\n' +
        'Try running the doctor command in your workspace folder.'
    );
  }

  const deps = Object.entries({
    ...packageJsonContents.dependencies,
    ...packageJsonContents.devDependencies,
  });

  const typeScriptVersion = deps.find((x) => x[0] === 'typescript');
  if (!typeScriptVersion) {
    yield logger.failedTask(Messages.CHECK_TS_VERSION);
    throw logger.errorMessage('Failed to find a "typescript" installation, try installing one.');
  } else if (semiver(typeScriptVersion[1], MINIMUM_VERSIONS.typescript) === -1) {
    // TypeScript version lower than v4.1 which is when they introduced template lits
    yield logger.failedTask(Messages.CHECK_TS_VERSION);
    throw logger.errorMessage(
      `Found an outdated "TypeScript" version.\ngql.tada requires at least ${MINIMUM_VERSIONS.typescript}.`
    );
  }

  yield logger.completedTask(Messages.CHECK_TS_VERSION);
  yield logger.runningTask(Messages.CHECK_DEPENDENCIES);

  const gqlspVersion = deps.find((x) => x[0] === "'@0no-co/graphqlsp'");
  if (!gqlspVersion) {
    yield logger.failedTask(Messages.CHECK_DEPENDENCIES);
    throw logger.errorMessage(
      'Failed to find a "@0no-co/graphqlsp" installation, try installing one.'
    );
  } else if (semiver(gqlspVersion[1], MINIMUM_VERSIONS.lsp) === -1) {
    yield logger.failedTask(Messages.CHECK_DEPENDENCIES);
    throw logger.errorMessage(
      `Found an outdated "@0no-co/graphqlsp" version, gql.tada requires at least ${MINIMUM_VERSIONS.lsp}.`
    );
  }

  const gqlTadaVersion = deps.find((x) => x[0] === "'gql.tada'");
  if (!gqlTadaVersion) {
    yield logger.failedTask(Messages.CHECK_DEPENDENCIES);
    throw logger.errorMessage('Failed to find a "gql.tada" installation, try installing one.');
  } else if (semiver(gqlTadaVersion[1], '1.0.0') === -1) {
    yield logger.failedTask(Messages.CHECK_DEPENDENCIES);
    throw logger.errorMessage(
      `Found an outdated "gql.tada" version, gql.tada requires at least ${MINIMUM_VERSIONS.tada}.`
    );
  }

  yield logger.completedTask(Messages.CHECK_DEPENDENCIES);
  yield logger.runningTask(Messages.CHECK_TSCONFIG);

  const tsconfigpath = path.resolve(cwd, 'tsconfig.json');
  const root = (await resolveTypeScriptRootDir(tsconfigpath)) || cwd;

  let tsconfigContents: string;
  try {
    const file = path.resolve(root, 'tsconfig.json');
    tsconfigContents = await fs.readFile(file, 'utf-8');
  } catch (_error) {
    yield logger.failedTask(Messages.CHECK_TSCONFIG);
    throw logger.errorMessage(
      'Failed to read tsconfig.json in current working directory, try adding a "tsconfig.json".'
    );
  }

  let tsConfig: TsConfigJson;
  try {
    tsConfig = parse(tsconfigContents) as TsConfigJson;
  } catch (error) {
    yield logger.failedTask(Messages.CHECK_TSCONFIG);
    throw logger.errorMessage(
      `Unable to parse tsconfig.json in current working directory.\n${error}`
    );
  }

  // Check GraphQLSP version, later on we can check if a ts version is > 5.5.0 to use gql.tada/lsp instead of
  // the LSP package.
  const config = getGraphQLSPConfig(tsConfig);
  if (!config) {
    yield logger.failedTask(Messages.CHECK_TSCONFIG);
    throw logger.errorMessage(`Missing a "@0no-co/graphqlsp" plugin in your tsconfig.`);
  }

  // TODO: this is optional I guess with the CLI being there and all
  if (!config.tadaOutputLocation) {
    yield logger.failedTask(Messages.CHECK_TSCONFIG);
    throw logger.errorMessage(
      `Missing a "tadaOutputLocation" setting in your GraphQLSP configuration.`
    );
  }

  if (!config.schema) {
    yield logger.failedTask(Messages.CHECK_TSCONFIG);
    throw logger.errorMessage(`Missing a "schema" setting in your GraphQLSP configuration.`);
  } else {
    const isFile =
      typeof config.schema === 'string' &&
      (config.schema.endsWith('.json') || config.schema.endsWith('.graphql'));
    if (isFile) {
      const resolvedFile = path.resolve(root, config.schema as string);
      if (!existsSync(resolvedFile)) {
        yield logger.failedTask(Messages.CHECK_TSCONFIG);
        throw logger.errorMessage(
          `The schema setting does not point at an existing file "${resolvedFile}"`
        );
      }
    } else {
      try {
        typeof config.schema === 'string' ? new URL(config.schema) : new URL(config.schema.url);
      } catch (e) {
        yield logger.failedTask(Messages.CHECK_TSCONFIG);
        throw logger.errorMessage(
          `The schema setting does not point at a valid URL: "${JSON.stringify(config.schema)}"`
        );
      }
    }
  }

  yield logger.completedTask(Messages.CHECK_DEPENDENCIES);
  yield logger.success();
}
