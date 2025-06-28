import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface PnpmWorkspaceConfig {
  packages?: string[];
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
}

const parseYaml = (content: string): PnpmWorkspaceConfig => {
  const lines = content.split('\n');
  const result: PnpmWorkspaceConfig = {};
  let currentSection: string | null = null;
  let currentCatalog: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.endsWith(':') && !trimmed.includes(' ')) {
      const key = trimmed.slice(0, -1).replace(/['"]/g, '');
      if (key === 'packages') {
        currentSection = 'packages';
        result.packages = [];
      } else if (key === 'catalog') {
        currentSection = 'catalog';
        result.catalog = {};
      } else if (key === 'catalogs') {
        currentSection = 'catalogs';
        result.catalogs = {};
      } else if (currentSection === 'catalogs') {
        currentCatalog = key;
        result.catalogs![key] = {};
      }
    } else if (trimmed.startsWith('- ')) {
      if (currentSection === 'packages') {
        result.packages!.push(trimmed.slice(2).replace(/['"]/g, ''));
      }
    } else if (trimmed.includes(':')) {
      const colonIndex = trimmed.indexOf(':');
      const key = trimmed.slice(0, colonIndex).trim().replace(/['"]/g, '');
      const value = trimmed
        .slice(colonIndex + 1)
        .trim()
        .replace(/['"]/g, '');

      if (currentSection === 'catalog') {
        result.catalog![key] = value;
      } else if (currentSection === 'catalogs' && currentCatalog) {
        result.catalogs![currentCatalog][key] = value;
      }
    }
  }

  return result;
};

const findPnpmWorkspaceroot = async (startPath: string = process.cwd()): Promise<string | null> => {
  let currentPath = startPath;
  const root = path.parse(currentPath).root;

  while (currentPath !== root) {
    const workspaceFile = path.join(currentPath, 'pnpm-workspace.yaml');
    try {
      await fs.access(workspaceFile);
      return currentPath;
    } catch {
      // File doesn't exist, continue searching
    }
    currentPath = path.dirname(currentPath);
  }

  return null;
};

const loadWorkspaceCatalogs = async (): Promise<PnpmWorkspaceConfig | null> => {
  const workspaceRoot = await findPnpmWorkspaceroot();
  if (!workspaceRoot) return null;

  try {
    const workspaceFile = path.join(workspaceRoot, 'pnpm-workspace.yaml');
    const content = await fs.readFile(workspaceFile, 'utf-8');
    return parseYaml(content);
  } catch {
    return null;
  }
};

/**
 * This attempts to resolve a catalog version from a catalog reference.
 * If the reference starts with 'catalog:', it extracts the catalog name.
 * If the catalog name is 'default' or empty, it returns null to indicate
 * that the default catalog should be used.
 * If the catalog name is anything else, it returns the catalog name.
 */
const resolvePnpmCatalogVersion = (catalogRef: string): string | null => {
  if (!catalogRef.startsWith('catalog:')) return null;

  const catalogName = catalogRef.slice(8); // Remove 'catalog:' prefix

  if (!catalogName || catalogName === 'default') {
    // Default catalog
    return null; // Will be resolved by package name lookup
  }

  // Named catalog
  return catalogName;
};

const getVersionFromPnpmCatalog = (
  packageName: string,
  catalogName: string | null,
  catalogs: PnpmWorkspaceConfig
): string | null => {
  if (catalogName) {
    // Named catalog
    return catalogs.catalogs?.[catalogName]?.[packageName] || null;
  } else {
    // Default catalog
    return catalogs.catalog?.[packageName] || null;
  }
};

// Enhanced version checking with catalog support
const getPackageVersion = async (
  packageName: string,
  meta: PackageJson
): Promise<string | null> => {
  // Check devDependencies first
  const devVersion = meta.devDependencies?.[packageName];
  if (devVersion) {
    if (devVersion.startsWith('catalog:')) {
      // Resolve catalog reference
      const catalogs = await loadWorkspaceCatalogs();
      if (catalogs) {
        const catalogName = resolvePnpmCatalogVersion(devVersion);
        const resolvedVersion = getVersionFromPnpmCatalog(packageName, catalogName, catalogs);
        if (resolvedVersion) return resolvedVersion;
      }
    } else {
      return devVersion;
    }
  }

  // Check dependencies
  const depVersion = meta.dependencies?.[packageName];
  if (depVersion) {
    if (depVersion.startsWith('catalog:')) {
      // Resolve catalog reference
      const catalogs = await loadWorkspaceCatalogs();
      if (catalogs) {
        const catalogName = resolvePnpmCatalogVersion(depVersion);
        const resolvedVersion = getVersionFromPnpmCatalog(packageName, catalogName, catalogs);
        if (resolvedVersion) return resolvedVersion;
      }
    } else {
      return depVersion;
    }
  }

  return null;
};

export const readPackageJson = async (): Promise<PackageJson> => {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const file = path.resolve(packageJsonPath);
  return JSON.parse(await fs.readFile(file, 'utf-8'));
};

export const getTypeScriptVersion = async (meta: PackageJson): Promise<string | null> => {
  const pkg = 'typescript';

  // Try to get version with catalog support
  const catalogVersion = await getPackageVersion(pkg, meta);
  if (catalogVersion) return catalogVersion;

  // Fallback to direct resolution
  try {
    return (await import(pkg)).version || null;
  } catch (_error) {
    return null;
  }
};

export const getGraphQLSPVersion = async (meta: PackageJson): Promise<string | null> => {
  const pkg = '@0no-co/graphqlsp';

  // Try to get version with catalog support
  const catalogVersion = await getPackageVersion(pkg, meta);
  if (catalogVersion) return catalogVersion;

  // Fallback to direct resolution
  try {
    // NOTE: Resolved from current folder, since it's a child dependency
    return createRequire(__dirname)(`${pkg}/package.json`)?.version || null;
  } catch (_error) {
    return null;
  }
};

export const getGqlTadaVersion = async (meta: PackageJson): Promise<string | null> => {
  const pkg = 'gql.tada';

  // Try to get version with catalog support
  const catalogVersion = await getPackageVersion(pkg, meta);
  if (catalogVersion) return catalogVersion;

  // Fallback to direct resolution
  try {
    // NOTE: Resolved from working directory, since it's a parent dependency
    return createRequire(process.cwd())(`${pkg}/package.json`)?.version || null;
  } catch (_error) {
    return null;
  }
};

// Enhanced support checking with catalog support
const hasPackageSupport = async (packageName: string, meta: PackageJson): Promise<boolean> => {
  // Check if package is listed in dependencies with catalog support
  const catalogVersion = await getPackageVersion(packageName, meta);
  if (catalogVersion) return true;

  // Fallback to direct resolution
  try {
    // NOTE: Resolved from current folder, since it's a child dependency
    return !!createRequire(__dirname)(`${packageName}/package.json`)?.version;
  } catch (_error) {
    return false;
  }
};

export const hasSvelteSupport = async (meta: PackageJson): Promise<boolean> => {
  return hasPackageSupport('@gql.tada/svelte-support', meta);
};

export const hasVueSupport = async (meta: PackageJson): Promise<boolean> => {
  return hasPackageSupport('@gql.tada/vue-support', meta);
};
