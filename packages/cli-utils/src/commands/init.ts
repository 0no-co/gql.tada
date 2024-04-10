import { intro, outro, isCancel, cancel, text, confirm, spinner } from '@clack/prompts';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import { parse, stringify } from 'json5';

const s = spinner();

const question = async (
  msg: string,
  validate: (value: string) => Promise<boolean>,
  repeat?: boolean
): Promise<string> => {
  let value: string | symbol = '';
  if (repeat) {
    while (!value || !isCancel(value) || (typeof value === 'string' && !validate(value))) {
      value = await text({
        message: msg,
      });
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

const TADA_VERSION = '^1.4.3';
const LSP_VERSION = '^1.8.0';
export const initGqlTada = async (cwd: string) => {
  intro(`GQL.Tada`);
  const schemaLocation = await question(
    'Where can we get your schema? Point us at an introspection JSON-file, a GraphQL schema file or an endpoint',
    async (value: string) => {
      // TODO: spinner during validation
      try {
        const url = new URL(value);
        s.start('Validating the URL.');
        const response = await fetch(url.toString());
        s.stop('Validated the URL.');
        if (!response.ok) {
          const urlFailureIsOkay = await confirm({
            message: `Got ${
              response.status
            } from ${url.toString()}, continue anyway? You can add headers later.`,
          });
          return !!urlFailureIsOkay;
        }
        return true;
      } catch (e) {}
      const isFile = value.endsWith('.json') || value.endsWith('.graphql');
      if (!isFile) {
        return false;
      }

      const filePath = path.resolve(cwd, value);
      const fileExists = !!(await fs.readFile(filePath));
      // eslint-disable-next-line no-console
      console.log(`Could not find "${filePath}"`);
      return fileExists;
    },
    true
  );

  const tadaLocation = await question(
    'What directory do you want us to write the tadaOutputFile to?',
    async (value: string) => {
      const dir = path.resolve(cwd, value);
      const directoryExists = !!(await fs.stat(dir));
      // eslint-disable-next-line no-console
      console.log(`Could not find "${dir}"`);
      return directoryExists;
    },
    true
  );

  const shouldInstallDependencies = await confirm({
    message: 'Do you want us to install the dependencies?',
  });

  if (shouldInstallDependencies) {
    s.start('Installing packages.');
    await installPackages(['gql.tada', '@0no-co/graphqlsp'], getPkgManager(), cwd);
    s.stop('Installed packages.');
  } else {
    s.start('Writing to package.json.');
    try {
      const packageJsonPath = path.resolve(cwd, 'package.json');
      const packageJsonContents = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContents);
      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        'gql.tada': TADA_VERSION,
        '@0no-co/graphqlsp': LSP_VERSION,
      };
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
    const tsConfigPath = path.resolve(cwd, 'tsconfig.json');
    const tsConfigContents = await fs.readFile(tsConfigPath, 'utf-8');
    const tsConfig = parse(tsConfigContents);
    // TODO: do we need to ensure that include contains the tadaOutputLocation?
    tsConfig.compilerOptions = {
      ...tsConfig.compilerOptions,
      plugins: [
        {
          name: '@0no-co/graphqlsp',
          schema: schemaLocation,
          tadaOutputLocation: tadaLocation,
        },
      ],
    };
    await fs.writeFile(tsConfigPath, stringify(tsConfig, null, 2));
  } catch (e) {}
  s.stop('Written to tsconfig.json.');

  outro(`Off to the races!`);
};

type PackageManager = 'yarn' | 'pnpm' | 'npm';
function installPackages(pkgs: Array<string>, packageManager: PackageManager, cwd: string) {
  return execa(
    packageManager,
    [
      // `yarn add` will fail if nothing is provided
      packageManager === 'yarn' ? (pkgs.length ? 'add' : '') : 'install',
      '-D',
      ...pkgs,
    ].filter(Boolean),
    {
      stdio: 'ignore',
      cwd,
    }
  );
}

function getPkgManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent || '';
  if (userAgent.startsWith('yarn')) return 'yarn';
  if (userAgent.startsWith('pnpm')) return 'pnpm';
  return 'npm';
}
