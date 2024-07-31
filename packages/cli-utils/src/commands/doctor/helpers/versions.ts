import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export const readPackageJson = async (): Promise<PackageJson> => {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const file = path.resolve(packageJsonPath);
  return JSON.parse(await fs.readFile(file, 'utf-8'));
};

export const getTypeScriptVersion = async (meta: PackageJson): Promise<string | null> => {
  const pkg = 'typescript';
  if (meta.devDependencies?.[pkg]) {
    return meta.devDependencies[pkg];
  } else if (meta.dependencies?.[pkg]) {
    return meta.dependencies[pkg];
  }
  try {
    return (await import(pkg)).version || null;
  } catch (_error) {
    return null;
  }
};

export const getGraphQLSPVersion = async (meta: PackageJson): Promise<string | null> => {
  const pkg = '@0no-co/graphqlsp';
  if (meta.devDependencies?.[pkg]) {
    return meta.devDependencies[pkg];
  } else if (meta.dependencies?.[pkg]) {
    return meta.dependencies[pkg];
  }
  try {
    // NOTE: Resolved from current folder, since it's a child dependency
    return createRequire(__dirname)(`${pkg}/package.json`)?.version || null;
  } catch (_error) {
    return null;
  }
};

export const getGqlTadaVersion = async (meta: PackageJson): Promise<string | null> => {
  const pkg = 'gql.tada';
  if (meta.devDependencies?.[pkg]) {
    return meta.devDependencies[pkg];
  } else if (meta.dependencies?.[pkg]) {
    return meta.dependencies[pkg];
  }
  try {
    // NOTE: Resolved from working directory, since it's a parent dependency
    return createRequire(process.cwd())(`${pkg}/package.json`)?.version || null;
  } catch (_error) {
    return null;
  }
};

export const hasSvelteSupport = async (meta: PackageJson): Promise<boolean> => {
  const pkg = '@gql.tada/svelte-support';
  const isInstalled = !!meta.devDependencies?.[pkg] || !!meta.devDependencies?.[pkg];
  if (isInstalled) {
    return true;
  }
  try {
    // NOTE: Resolved from current folder, since it's a child dependency
    return !!createRequire(__dirname)(`${pkg}/package.json`)?.version;
  } catch (_error) {
    return false;
  }
};

export const hasVueSupport = async (meta: PackageJson): Promise<boolean> => {
  const pkg = '@gql.tada/vue-support';
  const isInstalled = !!meta.devDependencies?.[pkg] || !!meta.devDependencies?.[pkg];
  if (isInstalled) {
    return true;
  }
  try {
    // NOTE: Resolved from current folder, since it's a child dependency
    return !!createRequire(__dirname)(`${pkg}/package.json`)?.version;
  } catch (_error) {
    return false;
  }
};
