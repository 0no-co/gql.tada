import { intro, outro, isCancel, cancel, text, confirm, spinner } from '@clack/prompts';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';

import { readTSConfigFile } from '@gql.tada/internal';
import { MINIMUM_VERSIONS, semiverComply } from '../doctor/runner';

const s = spinner();

const TADA_VERSION = '^1.4.3';
const LSP_VERSION = '^1.8.0';

export async function run(target: string) {
  intro(`GQL.Tada`);

  const schemaLocation = await question(
    'Where can we get your schema? Point us at an introspection JSON-file, a GraphQL schema file or an endpoint',
    async (value: string) => {
      try {
        const url = new URL(value);
        s.start('Validating the URL.');
        try {
          const response = await fetch(url.toString());
          if (!response.ok) {
            s.stop('Validated the URL.');
            const urlFailureIsOkay = await confirm({
              message: `Got ${
                response.status
              } from ${url.toString()}, continue anyway? You can add headers later.`,
            });
            return !!urlFailureIsOkay;
          }
        } catch (e) {
          s.stop('Validated the URL.');
          const urlFailureIsOkay = await confirm({
            message: `Got ${
              (e as Error).message
            } from ${url.toString()}, continue anyway? You can add headers later.`,
          });
          return !!urlFailureIsOkay;
        }
        s.stop('Validated the URL.');
        return true;
      } catch (e) {}
      const isFile = value.endsWith('.json') || value.endsWith('.graphql');
      if (!isFile) {
        return false;
      }

      const filePath = path.resolve(target, value);
      const fileExists = !!(await fs.readFile(filePath));
      if (!fileExists) {
        // eslint-disable-next-line no-console
        console.log(`\nCould not find "${filePath}"`);
      }

      return fileExists;
    },
    true
  );

  let tadaLocation = await question(
    'What directory do you want us to write the tadaOutputFile to?',
    async (value: string) => {
      const dir = path.resolve(target, value);
      const directoryExists = !!(await fs.stat(dir));
      if (!directoryExists) {
        // eslint-disable-next-line no-console
        console.log(`\nCould not find "${dir}"`);
      }

      return directoryExists;
    },
    true
  );

  if (isCancel(tadaLocation)) {
    cancel('Operation cancelled.');
    process.exit(0);
  }

  tadaLocation = path.resolve(tadaLocation, 'graphql-env.d.ts');

  const shouldInstallDependencies = await confirm({
    message: 'Do you want us to install the dependencies?',
  });

  if (isCancel(shouldInstallDependencies)) {
    cancel('Operation cancelled.');
    process.exit(0);
  }

  let supportsEmbeddedLsp = false;
  let packageJson: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  try {
    const packageJsonPath = path.resolve(target, 'package.json');
    const packageJsonContents = await fs.readFile(packageJsonPath, 'utf-8');
    packageJson = JSON.parse(packageJsonContents);
    const deps = Object.entries({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    });

    const typeScriptVersion = deps.find((x) => x[0] === 'typescript');
    if (typeScriptVersion && typeof typeScriptVersion[1] === 'string') {
      supportsEmbeddedLsp = semiverComply(
        typeScriptVersion[1],
        MINIMUM_VERSIONS.typescript_embed_lsp
      );
    }
  } catch (e) {}

  if (shouldInstallDependencies) {
    s.start('Installing packages.');
    await installPackages(getPkgManager(), target, !supportsEmbeddedLsp);
    s.stop('Installed packages.');
  } else {
    s.start('Writing to package.json.');
    try {
      const packageJsonPath = path.resolve(target, 'package.json');
      const packageJsonContents = await fs.readFile(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(packageJsonContents);

      if (!packageJson.dependencies) packageJson.dependencies = {};
      if (!packageJson.dependencies['gql.tada']) {
        packageJson.dependencies['gql.tada'] = TADA_VERSION;
      }

      if (!supportsEmbeddedLsp) {
        if (!packageJson.devDependencies) packageJson.devDependencies = {};
        if (!packageJson.devDependencies['@0no-co/graphqlsp']) {
          packageJson.devDependencies['@0no-co/graphqlsp'] = LSP_VERSION;
        }
      }

      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      s.stop('Written to package.json.');
    } catch (e) {
      s.stop(
        'Failed to write to package.json, you can try adding "gql.tada" and "@0no-co/graphqlsp" yourself.'
      );
    }
  }

  s.start('Writing to tsconfig.json.');
  try {
    const tsConfigPath = path.resolve(target, 'tsconfig.json');
    const tsConfig = await readTSConfigFile(tsConfigPath);
    // TODO: do we need to ensure that include contains the tadaOutputLocation?
    const isFile = schemaLocation.endsWith('.json') || schemaLocation.endsWith('.graphql');
    tsConfig.compilerOptions = {
      ...tsConfig.compilerOptions,
      plugins: [
        {
          name: supportsEmbeddedLsp ? 'gql.tada/ts-plugin' : '@0no-co/graphqlsp',
          schema: isFile ? path.relative(target, schemaLocation) : schemaLocation,
          tadaOutputLocation: path.relative(target, tadaLocation),
        } as any,
      ],
    };
    await fs.writeFile(tsConfigPath, JSON.stringify(tsConfig, null, 2));
  } catch (e) {}
  s.stop('Written to tsconfig.json.');

  outro(`Off to the races!`);
}

type PackageManager = 'yarn' | 'pnpm' | 'npm';
async function installPackages(
  packageManager: PackageManager,
  target: string,
  shouldInstallGraphQLSP
) {
  if (shouldInstallGraphQLSP) {
    await execa(
      packageManager,
      [
        // `yarn add` will fail if nothing is provided
        packageManager === 'yarn' ? 'add' : 'install',
        '-D',
        '@0no-co/graphqlsp',
      ],
      {
        stdio: 'ignore',
        cwd: target,
      }
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

const question = async (
  msg: string,
  validate: (value: string) => Promise<boolean>,
  repeat?: boolean
): Promise<string> => {
  let value: string | symbol = '';
  if (repeat) {
    // while there is no value or the value is not a cancel symbol and the value is not a string or the value is a string but the validation fails
    let done = false;
    while (!done) {
      value = await text({
        message: msg,
      });
      if (isCancel(value)) {
        done = true;
        cancel('Operation cancelled.');
        process.exit(0);
      } else if (await validate(value)) {
        done = true;
      }
    }
  } else {
    value = await text({
      message: msg,
    });
    if (isCancel(value)) {
      cancel('Operation cancelled.');
      process.exit(0);
    }
  }

  return value as string;
};
