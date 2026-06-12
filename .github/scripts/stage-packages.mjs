#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const root = process.cwd();
const config = JSON.parse(readFileSync(join(root, ".changeset/config.json"), "utf8"));
const ignored = new Set(config.ignore || []);
const access = config.access || "public";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// Resolve packages via pnpm so we only ever stage real workspace members.
// A filesystem walk would also pick up stray manifests (fixtures, vendored
// copies, examples) that live outside the pnpm-workspace.yaml globs and must
// never be published.
function packageJsonPaths() {
  const result = spawnSync(
    "pnpm",
    ["list", "--recursive", "--depth", "-1", "--json"],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );

  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error("Failed to resolve workspace packages with pnpm.");
  }

  const projects = JSON.parse(result.stdout);
  return [
    ...new Set(projects.map((project) => join(project.path, "package.json"))),
  ].filter(existsSync);
}

function versionExists(name, version) {
  const result = spawnSync("npm", ["view", `${name}@${version}`, "version", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status === 0) return true;
  const output = `${result.stdout}
${result.stderr}`;
  if (output.includes("E404") || output.includes("No match found")) return false;

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  throw new Error(`Could not check npm version for ${name}@${version}`);
}

function stableDistTag(version) {
  if (version.includes("-")) {
    throw new Error(
      `Refusing to stage prerelease version ${version}; staged publishing is only enabled for stable releases.`
    );
  }

  return "latest";
}

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status || 1);
}

function hasLocalGitTag(tagName) {
  const result = spawnSync(
    "git",
    ["rev-parse", "--verify", "--quiet", `refs/tags/${tagName}`],
    {
      cwd: root,
      stdio: "ignore",
    }
  );
  return result.status === 0;
}

function createGitTag(tagName) {
  if (hasLocalGitTag(tagName)) {
    console.log(`Git tag ${tagName} already exists locally.`);
  } else {
    runGit(["tag", tagName, "-m", tagName]);
  }

  // changesets/action parses this line, then pushes the tag and creates the GitHub release.
  console.log(`New tag: ${tagName}`);
}

const staged = [];
for (const packageJsonPath of packageJsonPaths()) {
  const pkg = readJson(packageJsonPath);
  if (!pkg.name || !pkg.version || pkg.private || ignored.has(pkg.name)) continue;
  const tag = stableDistTag(pkg.version);
  if (versionExists(pkg.name, pkg.version)) {
    console.log(`Skipping ${pkg.name}@${pkg.version}; already published.`);
    continue;
  }

  const packageDir = dirname(packageJsonPath);
  const args = [
    "stage",
    "publish",
    packageDir,
    "--provenance",
    "--access",
    pkg.publishConfig?.access || access,
    "--tag",
    tag,
    "--json",
  ];

  console.log(`Staging ${pkg.name}@${pkg.version} with dist-tag ${tag}...`);
  const result = spawnSync("pnpm", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status || 1);

  const stageId = result.stdout.match(/"stageId"\s*:\s*"([^"]+)"/)?.[1];
  const tagName = `${pkg.name}@${pkg.version}`;
  createGitTag(tagName);

  staged.push({
    name: pkg.name,
    version: pkg.version,
    path: relative(root, packageDir) || ".",
    stageId,
  });
}

if (staged.length === 0) {
  console.log("No unpublished packages to stage.");
} else {
  console.log("Staged packages:");
  for (const pkg of staged) {
    console.log(`- ${pkg.name}@${pkg.version}${pkg.stageId ? ` (${pkg.stageId})` : ""}`);
  }
  console.log("Approve staged packages with `npm stage approve <stage-id>` after review.");
}
