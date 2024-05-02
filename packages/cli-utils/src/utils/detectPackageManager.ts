import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const dirExists = async (...parts: readonly string[]) => {
  try {
    const stat = await fs.stat(path.resolve(...parts));
    return stat.isDirectory();
  } catch (_error) {
    return false;
  }
};

const fileExists = async (...parts: readonly string[]) => {
  try {
    const stat = await fs.stat(path.resolve(...parts));
    return stat.isFile();
  } catch (_error) {
    return false;
  }
};

const maybeReadFile = async (...parts: readonly string[]) => {
  try {
    return await fs.readFile(path.resolve(...parts), 'utf-8');
  } catch (_error) {
    return null;
  }
};

export enum PackageManager {
  npm = 'npm',
  yarn = 'yarn',
  pnpm = 'pnpm',
  bun = 'bun',
  unknown = 'unknown',
}

const cwd = process.cwd();
const modulesYamlRe = /\bpackageManager:\s*([\w-]+)@/;

export async function detectPackageManager(targetPath = cwd): Promise<PackageManager> {
  const userAgent = process.env.npm_config_user_agent || '';
  if (userAgent) {
    const specifier = userAgent.split(' ')[0];
    const name = specifier.slice(0, specifier.lastIndexOf('/'));
    if (name === 'cnpm') return PackageManager.npm;
    const result = name && PackageManager[name];
    if (result) return result as PackageManager;
  }

  const root = path.resolve(cwd, '/');
  let currentPath = targetPath;
  while (currentPath !== root) {
    // bun.lockb -> bun
    if (await fileExists(currentPath, 'bun.lockb')) return PackageManager.bun;
    // yarn.lock -> yarn
    if (await fileExists(currentPath, 'yarn.lock')) return PackageManager.yarn;
    // pnpm-lock.yaml -> pnpm
    if (await fileExists(currentPath, 'pnpm-lock.yaml')) return PackageManager.pnpm;
    // shrinkwrap.yaml -> pnpm
    if (await fileExists(currentPath, 'shrinkwrap.yaml')) return PackageManager.pnpm;
    // package-lock.json -> npm
    if (await fileExists(currentPath, 'package-lock.json')) return PackageManager.npm;
    if (await dirExists(currentPath, 'node_modules')) {
      // node_modules/.yarn-integrity -> yarn
      if (await fileExists(currentPath, 'node_modules', '.yarn-integrity'))
        return PackageManager.yarn;
      const modulesYamlPath = path.resolve(currentPath, 'node_modules', '.modules.yaml');
      const modulesYamlText = await maybeReadFile(modulesYamlPath);
      if (modulesYamlText) {
        const match = modulesYamlRe.exec(modulesYamlText);
        const result = match && PackageManager[match[1]];
        if (result) return result as PackageManager;
      }
    }
    // stop at git root
    if (await dirExists(currentPath, '.git')) break;
    currentPath = path.resolve(currentPath, '..');
  }
  return PackageManager.unknown;
}
