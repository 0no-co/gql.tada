#!/usr/bin/env node
// Type-checks each project in `fixtures/` with a TypeScript 7.1+ compatible compiler,
// running the built `@gql.tada/content-mapper`, and compares the reported diagnostics
// to the project's `expected.txt`.
//
//   node e2e/content-mapper/run.mjs --compiler typescript@7.1.0-beta
//   node e2e/content-mapper/run.mjs --compiler tsrs@latest
//   node e2e/content-mapper/run.mjs --bin ./node_modules/.bin/tsc --update
//
// The workspace pins TypeScript 5.9 (see `overrides` in `pnpm-workspace.yaml`), so each
// fixture is copied to a temporary directory, outside of the workspace, and the compiler
// is installed there. `pnpm build` must have been run first.
//
// NOTE: Mapper diagnostics are reported as syntax errors, and `tsc` doesn't report
// semantic errors while there are any, so fixtures with mapper diagnostics are kept
// separate from fixtures that check types.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(e2eDir, 'fixtures');
const rootDir = path.resolve(e2eDir, '../..');
const shell = process.platform === 'win32';

const { values: args } = parseArgs({
  options: {
    compiler: { type: 'string' },
    bin: { type: 'string' },
    update: { type: 'boolean', default: false },
  },
});

if (!args.compiler === !args.bin) {
  console.error('Pass either --compiler <package spec> or --bin <compiler executable>');
  process.exit(2);
}

const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8', shell, ...options });
  if (result.error) throw result.error;
  return result;
};

for (const [pkg, file] of [
  ['gql.tada', 'dist/gql-tada.d.ts'],
  ['@gql.tada/content-mapper', 'packages/content-mapper/dist/gql-tada-content-mapper-server.mjs'],
]) {
  if (!fs.existsSync(path.join(rootDir, file))) {
    console.error(`${pkg} hasn't been built. Run \`pnpm build\` first.`);
    process.exit(2);
  }
}

const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gql-tada-e2e-')));
process.on('exit', () => fs.rmSync(tmpDir, { recursive: true, force: true }));

let bin = args.bin && path.resolve(args.bin);
if (args.compiler) {
  const compilerDir = path.join(tmpDir, 'compiler');
  fs.mkdirSync(compilerDir);
  fs.writeFileSync(path.join(compilerDir, 'package.json'), '{"private":true}');
  const install = run('npm', ['install', '--no-audit', '--no-fund', args.compiler], {
    cwd: compilerDir,
    stdio: 'inherit',
  });
  if (install.status !== 0) process.exit(install.status || 1);
  const name = args.compiler.startsWith('tsrs') ? 'tsrs' : 'tsc';
  bin = path.join(compilerDir, 'node_modules', '.bin', name);
}

console.log(`Compiler: ${run(bin, ['--version']).stdout.trim()}\n`);

const checkFixture = (fixture) => {
  const projectDir = path.join(tmpDir, fixture);
  fs.cpSync(path.join(fixturesDir, fixture), projectDir, { recursive: true });
  fs.rmSync(path.join(projectDir, 'expected.txt'), { force: true });

  // The packages are linked rather than packed, so their own dependencies resolve
  // from the workspace through their real paths
  const link = (name, target) => {
    const linkPath = path.join(projectDir, 'node_modules', name);
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(target, linkPath, 'junction');
  };
  link('gql.tada', rootDir);
  link('@gql.tada/content-mapper', path.join(rootDir, 'packages/content-mapper'));

  const result = run(bin, ['-p', projectDir, '--runExternalCode', '--pretty', 'false'], {
    cwd: projectDir,
  });

  const output = `${result.stdout}${result.stderr}`
    .split(projectDir + path.sep)
    .join('')
    .split(/\r?\n/)
    .map((line) => line.trimEnd().replace(/\\/g, '/'))
    .filter(Boolean)
    .sort()
    .join('\n');

  const expectedFile = path.join(fixturesDir, fixture, 'expected.txt');
  if (args.update) {
    fs.writeFileSync(expectedFile, output ? `${output}\n` : '');
    console.log(`✓ ${fixture}: updated expected.txt`);
    return true;
  }

  const expected = fs.existsSync(expectedFile) ? fs.readFileSync(expectedFile, 'utf8').trim() : '';
  if (output !== expected) {
    console.error(`✗ ${fixture}: diagnostics differ from expected.txt\n`);
    console.error(`--- expected\n${expected}\n\n+++ actual\n${output}\n`);
    return false;
  }
  console.log(`✓ ${fixture}: ${expected ? expected.split('\n').length : 0} expected diagnostics`);
  return true;
};

const fixtures = fs
  .readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

let ok = true;
for (const fixture of fixtures) ok = checkFixture(fixture) && ok;
process.exitCode = ok ? 0 : 1;
