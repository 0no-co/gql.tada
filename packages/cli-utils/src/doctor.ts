import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'json5';
import semiver from 'semiver';
import type { TsConfigJson } from 'type-fest';
import { resolveTypeScriptRootDir } from '@gql.tada/internal';

import { getGraphQLSPConfig } from './lsp';
import { existsSync } from 'node:fs';

export async function executeTadaDoctor() {
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
  } catch (error) {
    console.error(
      'Failed to read package.json in current working directory, try running the doctor command in your workspace folder.'
    );
    return;
  }

  const typeScriptVersion = Object.entries({
    ...packageJsonContents.dependencies,
    ...packageJsonContents.devDependencies,
  }).find((x) => x[0] === 'typescript');
  if (!typeScriptVersion) {
    console.error('Failed to find a typescript installation, try installing one.');
    return;
  } else if (semiver(typeScriptVersion[1], '4.1.0') === -1) {
    // TypeScript version lower than v4.1 which is when they introduced template lits
    console.error('Found an outdated TypeScript version, gql.tada requires at least 4.1.0.');
    return;
  }

  const gqlspVersion = Object.entries({
    ...packageJsonContents.dependencies,
    ...packageJsonContents.devDependencies,
  }).find((x) => x[0] === '@0no-co/graphqlsp');
  if (!gqlspVersion) {
    console.error('Failed to find a "@0no-co/graphqlsp" installation, try installing one.');
    return;
  } else if (semiver(gqlspVersion[1], '1.0.0') === -1) {
    // TypeScript version lower than v4.1 which is when they introduced template lits
    console.error(
      'Found an outdated "@0no-co/graphqlsp" version, gql.tada requires at least 1.0.0.'
    );
    return;
  }

  const gqlTadaVersion = Object.entries({
    ...packageJsonContents.dependencies,
    ...packageJsonContents.devDependencies,
  }).find((x) => x[0] === 'gql.tada');
  if (!gqlTadaVersion) {
    console.error('Failed to find a "gql.tada" installation, try installing one.');
    return;
  } else if (semiver(gqlTadaVersion[1], '1.0.0') === -1) {
    // TypeScript version lower than v4.1 which is when they introduced template lits
    console.error('Found an outdated "gql.tada" version, gql.tada requires at least 1.0.0.');
    return;
  }

  const tsconfigpath = path.resolve(cwd, 'tsconfig.json');

  const root = (await resolveTypeScriptRootDir(tsconfigpath)) || cwd;

  let tsconfigContents: string;
  try {
    const file = path.resolve(root, 'tsconfig.json');
    tsconfigContents = await fs.readFile(file, 'utf-8');
  } catch (error) {
    console.error(
      'Failed to read tsconfig.json in current working directory, try adding a "tsconfig.json".'
    );
    return;
  }

  let tsConfig: TsConfigJson;
  try {
    tsConfig = parse(tsconfigContents) as TsConfigJson;
  } catch (err) {
    console.error('Unable to parse tsconfig.json in current working directory.', err);
    return;
  }

  // Check GraphQLSP version, later on we can check if a ts version is > 5.5.0 to use gql.tada/lsp instead of
  // the LSP package.
  const config = getGraphQLSPConfig(tsConfig);
  if (!config) {
    console.error(`Missing a "@0no-co/graphqlsp" plugin in your tsconfig.`);
    return;
  }

  // TODO: this is optional I guess with the CLI being there and all
  if (!config.tadaOutputLocation) {
    console.error(`Missing a "tadaOutputLocation" setting in your GraphQLSP configuration.`);
    return;
  }

  if (!config.schema) {
    console.error(`Missing a "schema" setting in your GraphQLSP configuration.`);
    return;
  } else {
    const isFile =
      typeof config.schema === 'string' &&
      (config.schema.endsWith('.json') || config.schema.endsWith('.graphql'));
    if (isFile) {
      const resolvedFile = path.resolve(root, config.schema as string);
      if (!existsSync(resolvedFile)) {
        console.error(`The schema setting does not point at an existing file "${resolvedFile}"`);
        return;
      }
    } else {
      try {
        typeof config.schema === 'string' ? new URL(config.schema) : new URL(config.schema.url);
      } catch (e) {
        console.error(
          `The schema setting does not point at a valid URL "${JSON.stringify(config.schema)}"`
        );
        return;
      }
    }
  }
}
