import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { Cli } from 'clipanion';
import { afterEach, describe, expect, it } from 'vitest';

import { InitCommand } from '../index';
import { configureProject } from '../runner';

const temporaryDirectories: string[] = [];

async function fixture(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gql-tada-init-'));
  temporaryDirectories.push(directory);
  await fs.mkdir(path.join(directory, 'src'));
  await fs.writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify({ devDependencies: { typescript: '^5.9.0' } }) + '\n'
  );
  await fs.writeFile(path.join(directory, 'schema.graphql'), 'type Query { hello: String }\n');
  await fs.writeFile(
    path.join(directory, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        plugins: [{ name: 'some-other-plugin', option: true }],
      },
    }) + '\n'
  );
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true }))
  );
});

describe('configureProject', () => {
  it('accepts --no-install through the non-interactive CLI without prompting', async () => {
    const directory = await fixture();
    const stdout = new PassThrough();
    let output = '';
    stdout.on('data', (chunk) => (output += chunk.toString()));
    const cli = Cli.from([InitCommand], { binaryName: 'gql.tada' });

    const exit = await cli.run(
      [
        'init',
        directory,
        '--schema',
        './schema.graphql',
        '--output',
        './src/graphql-env.d.ts',
        '--no-install',
      ],
      { stdout }
    );

    expect(exit).toBe(0);
    expect(output).toContain('Configured gql.tada');
  });

  it('requires choosing install behavior for non-interactive mode', async () => {
    const directory = await fixture();
    const stdout = new PassThrough();
    let output = '';
    stdout.on('data', (chunk) => (output += chunk.toString()));
    const cli = Cli.from([InitCommand], { binaryName: 'gql.tada' });

    const missingInstallExit = await cli.run(['init', directory, '--schema', './schema.graphql'], {
      stdout,
    });
    expect(missingInstallExit).toBe(1);
    expect(output).toContain('Non-interactive init requires either --install or --no-install.');

    output = '';
    const missingSchemaExit = await cli.run(['init', directory, '--no-install'], { stdout });
    expect(missingSchemaExit).toBe(1);
    expect(output).toContain('Non-interactive init requires --schema.');
  });

  it('configures a project non-interactively without running a package manager', async () => {
    const directory = await fixture();
    const result = await configureProject(directory, {
      schema: './schema.graphql',
      output: './src/graphql-env.d.ts',
      install: false,
    });

    expect(result).toMatchObject({ installed: false });
    const packageJson = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
    expect(packageJson.dependencies['gql.tada']).toBeDefined();
    expect(packageJson.devDependencies['@0no-co/graphqlsp']).toBeUndefined();

    const tsconfig = JSON.parse(await fs.readFile(path.join(directory, 'tsconfig.json'), 'utf8'));
    expect(tsconfig.compilerOptions.plugins).toEqual([
      { name: 'some-other-plugin', option: true },
      {
        name: 'gql.tada/ts-plugin',
        schema: 'schema.graphql',
        tadaOutputLocation: path.join('src', 'graphql-env.d.ts'),
      },
    ]);
  });

  it('replaces an existing gql.tada plugin without removing unrelated plugins', async () => {
    const directory = await fixture();
    const tsconfigPath = path.join(directory, 'tsconfig.json');
    await fs.writeFile(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: {
          plugins: [
            { name: 'gql.tada/ts-plugin', schema: './old.graphql' },
            { name: 'some-other-plugin' },
          ],
        },
      })
    );

    await configureProject(directory, {
      schema: 'https://example.test/graphql',
      output: './graphql-env.d.ts',
      install: false,
    });

    const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, 'utf8'));
    expect(tsconfig.compilerOptions.plugins).toEqual([
      { name: 'some-other-plugin' },
      {
        name: 'gql.tada/ts-plugin',
        schema: 'https://example.test/graphql',
        tadaOutputLocation: 'graphql-env.d.ts',
      },
    ]);
  });

  it('fails before modifying files when tsconfig.json cannot be loaded', async () => {
    const directory = await fixture();
    const packageJsonPath = path.join(directory, 'package.json');
    const before = await fs.readFile(packageJsonPath, 'utf8');
    await fs.rm(path.join(directory, 'tsconfig.json'));

    await expect(
      configureProject(directory, {
        schema: './schema.graphql',
        output: './src/graphql-env.d.ts',
        install: false,
      })
    ).rejects.toThrow();
    expect(await fs.readFile(packageJsonPath, 'utf8')).toBe(before);
  });

  it('fails before modifying files when a local schema does not exist', async () => {
    const directory = await fixture();
    const packageJsonPath = path.join(directory, 'package.json');
    const before = await fs.readFile(packageJsonPath, 'utf8');

    await expect(
      configureProject(directory, {
        schema: './missing.graphql',
        output: './src/graphql-env.d.ts',
        install: false,
      })
    ).rejects.toThrow('Could not find schema file');
    expect(await fs.readFile(packageJsonPath, 'utf8')).toBe(before);
  });
});
