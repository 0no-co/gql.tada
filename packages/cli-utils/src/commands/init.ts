import { intro, outro, isCancel, cancel, text, confirm, spinner } from '@clack/prompts';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import { ensureTadaIntrospection } from '../tada';

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

export const initGqlTada = async (cwd: string) => {
  intro(`GQL.Tada`);
  const schemaLocation = await question(
    'Where can we get your schema? Point us at an introspection JSON-file, a GraphQL schema file or an endpoint',
    async (value: string) => {
      // TODO: spinner during validation
      try {
        new URL(value);
        // TODO: do we do a simple fetch call to validate the URL?
        return true;
      } catch (e) {}
      const isFile = value.endsWith('.json') || value.endsWith('.graphql');
      if (!isFile) {
        return false;
      }

      const fileExists = !!(await fs.readFile(path.resolve(cwd, value)));
      // TODO: if the file doesn't exist leave a message
      return fileExists;
    },
    true
  );

  const isFile = schemaLocation.endsWith('.json') || schemaLocation.endsWith('.graphql');
  if (!isFile) {
    // Ask if we need a header
  }

  const tadaLocation = await question(
    'What directory do you want us to write the tadaOutputFile to?',
    async (value: string) => {
      const directoryExists = !!(await fs.stat(path.resolve(cwd, value)));
      // TODO: if the directory doesn't exist leave a message
      return directoryExists;
    },
    true
  );

  s.start('Writing your tada-output types.');
  await ensureTadaIntrospection(
    isFile ? schemaLocation : { url: schemaLocation },
    tadaLocation,
    cwd,
    true
  );
  s.stop('Tada-output types written.');

  const shouldInstallDependencies = await confirm({
    message: 'Do you want us to install the dependencies?',
  });

  if (shouldInstallDependencies) {
    s.start('Installing packages.');
    await installPackages(['gql.tada', '@0no-co/graphqlsp'], getPkgManager(), cwd);
    s.stop('Installed packages.');
  } else {
    // TODO: add deps in the package.json manually
  }

  // TODO: add plugin in tsconfig.json and ensure tadaOutputLocation is
  // in the "include" property.

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
