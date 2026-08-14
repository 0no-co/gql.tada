import { intro, outro, isCancel, cancel, text, confirm, spinner } from '@clack/prompts';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';

import { MINIMUM_VERSIONS, semverComply } from '../../utils/semver';
import { readTSConfigFile } from '@gql.tada/internal';

const TADA_VERSION = '^1.4.3';
const LSP_VERSION = '^1.8.0';

export interface InitOptions {
  schema: string;
  output: string;
  install: boolean;
}

export interface InitResult {
  target: string;
  tsconfig: string;
  output: string;
  installed: boolean;
}

export class InitCancelledError extends Error {
  constructor() {
    super('Operation cancelled.');
    this.name = 'InitCancelledError';
  }
}

/** Configures a project without prompting. This is shared by interactive and agent/CI flows. */
export async function configureProject(target: string, opts: InitOptions): Promise<InitResult> {
  target = path.resolve(target);
  await validateSchema(target, opts.schema);

  const packageJsonPath = path.resolve(target, 'package.json');
  const packageJsonContents = await fs.readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(packageJsonContents) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  // Parse and select the target config before changing package.json or installing anything.
  const { tsConfigPath, tsConfig } = await findProjectTSConfig(target);
  const deps = Object.entries({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  });
  const typeScriptVersion = deps.find((entry) => entry[0] === 'typescript');
  const supportsEmbeddedLsp =
    !!typeScriptVersion &&
    typeof typeScriptVersion[1] === 'string' &&
    semverComply(typeScriptVersion[1], MINIMUM_VERSIONS.typescript_embed_lsp);

  if (opts.install) {
    await installPackages(getPkgManager(), target, !supportsEmbeddedLsp);
  } else {
    packageJson.dependencies ||= {};
    packageJson.dependencies['gql.tada'] ||= TADA_VERSION;
    if (!supportsEmbeddedLsp) {
      packageJson.devDependencies ||= {};
      packageJson.devDependencies['@0no-co/graphqlsp'] ||= LSP_VERSION;
    }
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  const outputPath = path.resolve(target, opts.output);
  const isSchemaFile = opts.schema.endsWith('.json') || opts.schema.endsWith('.graphql');
  const tsConfigDir = path.dirname(tsConfigPath);
  const pluginName = supportsEmbeddedLsp ? 'gql.tada/ts-plugin' : '@0no-co/graphqlsp';
  const existingPlugins = Array.isArray(tsConfig.compilerOptions?.plugins)
    ? tsConfig.compilerOptions.plugins.filter((plugin: any) => {
        return (
          !plugin || (plugin.name !== 'gql.tada/ts-plugin' && plugin.name !== '@0no-co/graphqlsp')
        );
      })
    : [];

  tsConfig.compilerOptions = {
    ...tsConfig.compilerOptions,
    plugins: [
      ...existingPlugins,
      {
        name: pluginName,
        schema: isSchemaFile
          ? path.relative(tsConfigDir, path.resolve(target, opts.schema))
          : opts.schema,
        tadaOutputLocation: path.relative(tsConfigDir, outputPath),
      } as any,
    ],
  };
  await fs.writeFile(tsConfigPath, JSON.stringify(tsConfig, null, 2) + '\n');

  return {
    target,
    tsconfig: tsConfigPath,
    output: outputPath,
    installed: opts.install,
  };
}

export async function run(target: string): Promise<InitResult> {
  const s = spinner();
  intro('GQL.Tada');

  try {
    const schema = await question(
      'Where can we get your schema? Point us at an introspection JSON-file, a GraphQL schema file or an endpoint',
      async (value) => {
        try {
          const url = new URL(value);
          s.start('Validating the URL.');
          try {
            const response = await fetch(url);
            if (response.ok) return true;
            const shouldContinue = await confirm({
              message: `Got ${response.status} from ${url}, continue anyway? You can add headers later.`,
            });
            if (isCancel(shouldContinue)) throw new InitCancelledError();
            return shouldContinue;
          } catch (error) {
            if (error instanceof InitCancelledError) throw error;
            const shouldContinue = await confirm({
              message: `Got ${(error as Error).message} from ${url}, continue anyway? You can add headers later.`,
            });
            if (isCancel(shouldContinue)) throw new InitCancelledError();
            return shouldContinue;
          } finally {
            s.stop('Validated the URL.');
          }
        } catch (error) {
          if (error instanceof InitCancelledError) throw error;
          try {
            await validateSchema(target, value);
            return true;
          } catch {
            return false;
          }
        }
      }
    );

    const outputDirectory = await question(
      'What directory do you want us to write the tadaOutputFile to?',
      async (value) => {
        try {
          return (await fs.stat(path.resolve(target, value))).isDirectory();
        } catch {
          return false;
        }
      }
    );

    const shouldInstallDependencies = await confirm({
      message: 'Do you want us to install the dependencies?',
    });
    if (isCancel(shouldInstallDependencies)) throw new InitCancelledError();

    s.start(
      shouldInstallDependencies ? 'Installing and configuring packages.' : 'Configuring project.'
    );
    const result = await configureProject(target, {
      schema,
      output: path.join(outputDirectory, 'graphql-env.d.ts'),
      install: shouldInstallDependencies,
    });
    s.stop(`Written to ${path.relative(target, result.tsconfig) || 'tsconfig.json'}.`);
    outro('Off to the races!');
    return result;
  } catch (error) {
    if (error instanceof InitCancelledError) {
      cancel(error.message);
    }
    throw error;
  }
}

async function findProjectTSConfig(target: string): Promise<{
  tsConfigPath: string;
  tsConfig: Awaited<ReturnType<typeof readTSConfigFile>>;
}> {
  let tsConfigPath = path.resolve(target, 'tsconfig.json');
  let tsConfig = await readTSConfigFile(tsConfigPath);

  const isSolutionStyle =
    Array.isArray(tsConfig.references) &&
    Array.isArray(tsConfig.files) &&
    !tsConfig.files.length &&
    !tsConfig.include;
  if (isSolutionStyle) {
    let fallbackPath: string | undefined;
    let preferredPath: string | undefined;
    for (const reference of tsConfig.references!) {
      if (!reference || typeof reference.path !== 'string') continue;
      let referencePath = path.resolve(target, reference.path);
      if (path.extname(referencePath) !== '.json') {
        referencePath = path.join(referencePath, 'tsconfig.json');
      }
      try {
        await fs.access(referencePath);
      } catch {
        continue;
      }
      if (path.basename(referencePath) === 'tsconfig.app.json') {
        preferredPath = referencePath;
        break;
      } else if (!fallbackPath) {
        fallbackPath = referencePath;
      }
    }
    const referencePath = preferredPath || fallbackPath;
    if (referencePath) {
      tsConfigPath = referencePath;
      tsConfig = await readTSConfigFile(tsConfigPath);
    }
  }

  return { tsConfigPath, tsConfig };
}

async function validateSchema(target: string, schema: string): Promise<void> {
  try {
    new URL(schema);
    return;
  } catch {
    // Local schema paths are validated below.
  }

  if (!schema.endsWith('.json') && !schema.endsWith('.graphql')) {
    throw new Error(
      'Schema must be an endpoint URL, introspection JSON file, or GraphQL SDL file.'
    );
  }
  const schemaPath = path.resolve(target, schema);
  const stat = await fs.stat(schemaPath).catch(() => undefined);
  if (!stat?.isFile()) throw new Error(`Could not find schema file "${schemaPath}".`);
}

type PackageManager = 'yarn' | 'pnpm' | 'npm';
async function installPackages(
  packageManager: PackageManager,
  target: string,
  shouldInstallGraphQLSP: boolean
): Promise<void> {
  if (shouldInstallGraphQLSP) {
    await execa(
      packageManager,
      [packageManager === 'yarn' ? 'add' : 'install', '-D', '@0no-co/graphqlsp'],
      { stdio: 'ignore', cwd: target }
    );
  }

  await execa(packageManager, [packageManager === 'yarn' ? 'add' : 'install', 'gql.tada'], {
    stdio: 'ignore',
    cwd: target,
  });
}

function getPkgManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent || '';
  if (userAgent.startsWith('yarn')) return 'yarn';
  if (userAgent.startsWith('pnpm')) return 'pnpm';
  return 'npm';
}

async function question(
  message: string,
  validate: (value: string) => Promise<boolean>
): Promise<string> {
  while (true) {
    const value = await text({ message });
    if (isCancel(value)) throw new InitCancelledError();
    if (await validate(value)) return value;
  }
}
