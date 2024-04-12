import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'json5';
import semiver from 'semiver';
import type { TsConfigJson } from 'type-fest';
import { resolveTypeScriptRootDir } from '@gql.tada/internal';
import { existsSync } from 'node:fs';

import { initTTY } from '../../term';
import * as logger from './logger';

// NOTE: Currently, most tasks in this command complete too quickly
// We slow them down to make the CLI output easier to follow along to
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
  CHECK_SCHEMA = 'Checking schema',
}

const MINIMUM_VERSIONS = {
  typescript: '4.1.0',
  tada: '1.0.0',
  lsp: '1.0.0',
};

export async function executeTadaDoctor() {
  await initTTY().start(run());
}

export async function* run() {
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
  } else if (semiver(typeScriptVersion[1], MINIMUM_VERSIONS.typescript) === -1) {
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

  const gqlspVersion = deps.find((x) => x[0] === '@0no-co/graphqlsp');
  if (!gqlspVersion) {
    yield logger.failedTask(Messages.CHECK_DEPENDENCIES);
    throw logger.errorMessage(
      `A version of ${logger.code('@0no-co/graphqlsp')} was not found in your dependencies.\n` +
        logger.hint(`Is ${logger.code('@0no-co/graphqlsp')} installed?`)
    );
  } else if (semiver(gqlspVersion[1], MINIMUM_VERSIONS.lsp) === -1) {
    yield logger.failedTask(Messages.CHECK_DEPENDENCIES);
    throw logger.errorMessage(
      `The version of ${logger.code('@0no-co/graphqlsp')} in your dependencies is out of date.\n` +
        logger.hint(
          `${logger.code('gql.tada')} requires at least ${logger.bold(MINIMUM_VERSIONS.lsp)}`
        )
    );
  }

  const gqlTadaVersion = deps.find((x) => x[0] === 'gql.tada');
  if (!gqlTadaVersion) {
    yield logger.failedTask(Messages.CHECK_DEPENDENCIES);
    throw logger.errorMessage(
      `A version of ${logger.code('gql.tada')} was not found in your dependencies.\n` +
        logger.hint(`Is ${logger.code('gql.tada')} installed?`)
    );
  } else if (semiver(gqlTadaVersion[1], '1.0.0') === -1) {
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

  const tsconfigpath = path.resolve(cwd, 'tsconfig.json');

  let tsconfigContents: string;
  try {
    tsconfigContents = await fs.readFile(tsconfigpath, 'utf-8');
  } catch (_error) {
    yield logger.failedTask(Messages.CHECK_TSCONFIG);
    throw logger.errorMessage(
      `A ${logger.code('tsconfig.json')} file was not found in the current working directory.\n` +
        logger.hint(
          `Set up a new ${logger.code('tsconfig.json')} containing ${logger.code(
            '@0no-co/graphqlp'
          )}.`
        )
    );
  }

  let tsConfig: TsConfigJson;
  try {
    tsConfig = parse(tsconfigContents) as TsConfigJson;
  } catch (error: any) {
    yield logger.failedTask(Messages.CHECK_TSCONFIG);
    throw logger.errorMessage(
      `Your ${logger.code('tsconfig.json')} file could not be parsed.\n` +
        logger.console(error.message)
    );
  }

  let root: string;
  try {
    root = (await resolveTypeScriptRootDir(tsconfigpath)) || cwd;
  } catch (error: any) {
    yield logger.failedTask(Messages.CHECK_TSCONFIG);
    throw logger.errorMessage(
      `Failed to resolve a ${logger.code('"extends"')} reference in your ${logger.code(
        'tsconfig.json'
      )}.\n` + logger.console(error.message)
    );
  }

  if (root !== cwd) {
    try {
      tsconfigContents = await fs.readFile(path.resolve(root, 'tsconfig.json'), 'utf-8');
      tsConfig = parse(tsconfigContents) as TsConfigJson;
    } catch (error: any) {
      const relative = path.relative(process.cwd(), root);
      yield logger.failedTask(Messages.CHECK_TSCONFIG);
      throw logger.errorMessage(
        `The ${logger.code('tsconfig.json')} file at ${logger.code(
          relative
        )} could not be loaded.\n` + logger.console(error.message)
      );
    }
  }

  // Check GraphQLSP version, later on we can check if a ts version is > 5.5.0 to use gql.tada/lsp instead of
  // the LSP package.
  const config =
    tsConfig &&
    tsConfig.compilerOptions &&
    tsConfig.compilerOptions.plugins &&
    (tsConfig.compilerOptions.plugins.find(
      (plugin) => plugin.name === '@0no-co/graphqlsp' || plugin.name === 'gql.tada/lsp'
    ) as any);
  if (!config) {
    yield logger.failedTask(Messages.CHECK_TSCONFIG);
    throw logger.errorMessage(
      `No ${logger.code('"@0no-co/graphqlsp"')} plugin was found in your ${logger.code(
        'tsconfig.json'
      )}.\n` + logger.hint(`Have you set up ${logger.code('"@0no-co/graphqlsp"')} yet?`)
    );
  }

  // TODO: this is optional I guess with the CLI being there and all
  if (!config.tadaOutputLocation) {
    yield logger.failedTask(Messages.CHECK_TSCONFIG);
    throw logger.errorMessage(
      `No ${logger.code('"tadaOutputLocation"')} option was found in your configuration.\n` +
        logger.hint(
          `Have you chosen an output path for ${logger.code('gql.tada')}'s declaration file yet?`
        )
    );
  }

  if (!config.schema) {
    yield logger.failedTask(Messages.CHECK_TSCONFIG);
    throw logger.errorMessage(
      `No ${logger.code('"schema"')} option was found in your configuration.\n` +
        logger.hint(`Have you specified your SDL file or URL in your configuration yet?`)
    );
  }

  yield logger.completedTask(Messages.CHECK_TSCONFIG);
  yield logger.runningTask(Messages.CHECK_SCHEMA);
  await delay();

  // TODO: This doesn't match laoders. Should we just use loaders here?
  const isFile =
    typeof config.schema === 'string' &&
    (config.schema.endsWith('.json') || config.schema.endsWith('.graphql'));
  if (isFile) {
    const resolvedFile = path.resolve(root, config.schema as string);
    if (!existsSync(resolvedFile)) {
      yield logger.failedTask(Messages.CHECK_TSCONFIG);
      throw logger.errorMessage(
        `Could not find the SDL file that ${logger.code('"schema"')} is specifying.\n` +
          logger.hint(`Have you specified a valid SDL file in your configuration?`)
      );
    }
  } else {
    try {
      typeof config.schema === 'string' ? new URL(config.schema) : new URL(config.schema.url);
    } catch (_error) {
      yield logger.failedTask(Messages.CHECK_TSCONFIG);
      throw logger.errorMessage(
        `The ${logger.code('"schema"')} option is neither a valid URL nor a valid file.\n` +
          logger.hint(`Have you specified a valid URL in your configuration?`)
      );
    }
  }

  yield logger.completedTask(Messages.CHECK_SCHEMA, true);
  await delay();

  yield logger.success();
}
