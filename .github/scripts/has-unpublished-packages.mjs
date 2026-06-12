import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Resolve packages via pnpm so we only ever consider real workspace members.
// A filesystem walk would also pick up stray manifests (fixtures, vendored
// copies, examples) that live outside the pnpm-workspace.yaml globs.
function findPackageManifests(directory) {
  const result = spawnSync(
    'pnpm',
    ['list', '--recursive', '--depth', '-1', '--json'],
    { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );

  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error('Failed to resolve workspace packages with pnpm.');
  }

  return JSON.parse(result.stdout)
    .filter(pkg => !pkg.private && pkg.name && pkg.version)
    .map(pkg => ({ name: pkg.name, version: pkg.version }));
}

async function hasPublishedVersion(pkg) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
  });

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    throw new Error(`Failed to query ${pkg.name}: ${response.status} ${response.statusText}`);
  }

  const metadata = await response.json();
  return Object.prototype.hasOwnProperty.call(metadata.versions ?? {}, pkg.version);
}

async function main() {
  const packages = findPackageManifests(process.cwd()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  let hasUnpublished = false;

  for (const pkg of packages) {
    const isPublished = await hasPublishedVersion(pkg);

    if (isPublished) {
      console.log(`${pkg.name}@${pkg.version} is already published`);
    } else {
      console.log(`${pkg.name}@${pkg.version} is not published yet`);
      hasUnpublished = true;
    }
  }

  const output =
    [`has_unpublished=${String(hasUnpublished)}`, `should_publish=${String(hasUnpublished)}`].join(
      '\n'
    ) + '\n';

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, output);
  } else {
    process.stdout.write(output);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
