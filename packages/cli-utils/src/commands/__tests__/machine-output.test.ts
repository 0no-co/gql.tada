import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalCwd = process.cwd();
const originalExitCode = process.exitCode;
const temporaryDirectories: string[] = [];

async function fixture(valid = true): Promise<string> {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'gql-tada-machine-'));
  const directory = await fs.realpath(temporaryDirectory);
  temporaryDirectories.push(directory);
  if (!valid) return directory;

  await fs.writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify({
      dependencies: { 'gql.tada': '1.11.3' },
      devDependencies: { typescript: '5.9.3' },
    })
  );
  await fs.writeFile(path.join(directory, 'schema.graphql'), 'type Query { hello: String }\n');
  await fs.writeFile(
    path.join(directory, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        plugins: [
          {
            name: 'gql.tada/ts-plugin',
            schema: './schema.graphql',
            tadaOutputLocation: './graphql-env.d.ts',
          },
        ],
      },
      files: [],
    })
  );
  return directory;
}

function captureStdout() {
  const stdout = Object.assign(new PassThrough(), { isTTY: false });
  const stderr = Object.assign(new PassThrough(), { isTTY: false });
  let output = '';
  stdout.on('data', (chunk) => (output += chunk.toString()));
  vi.spyOn(process, 'stdout', 'get').mockReturnValue(stdout as unknown as typeof process.stdout);
  vi.spyOn(process, 'stderr', 'get').mockReturnValue(stderr as unknown as typeof process.stderr);
  return () => output;
}

afterEach(async () => {
  process.chdir(originalCwd);
  process.exitCode = originalExitCode;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true }))
  );
});

describe('machine-readable command output', () => {
  it('writes a clean doctor JSON report to stdout', async () => {
    vi.stubEnv('CI', '1');
    const directory = await fixture();
    process.chdir(directory);
    const output = captureStdout();
    vi.resetModules();
    const { DoctorCommand } = await import('../doctor');
    const command = new DoctorCommand();
    command.format = 'json';
    command.output = undefined;

    const exit = await command.execute();
    const text = output();
    expect(exit).toBe(0);
    expect(text).not.toMatch(/\x1b\[/);
    expect(text).not.toContain('::error');
    expect(JSON.parse(text)).toMatchObject({
      schemaVersion: 1,
      command: 'doctor',
      success: true,
    });
  });

  it('returns structured doctor failures and preserves a non-zero exit code', async () => {
    vi.stubEnv('CI', '1');
    const directory = await fixture(false);
    process.chdir(directory);
    const output = captureStdout();
    vi.resetModules();
    const { DoctorCommand } = await import('../doctor');
    const command = new DoctorCommand();
    command.format = 'json';
    command.output = undefined;

    expect(await command.execute()).toBe(1);
    const report = JSON.parse(output());
    expect(report).toMatchObject({
      schemaVersion: 1,
      command: 'doctor',
      success: false,
      error: { exitCode: 1 },
    });
    expect(report.issues[0]).toMatchObject({ severity: 'error' });
  });

  it('resets process.exitCode for successful machine JSON output', async () => {
    vi.stubEnv('CI', '1');
    const directory = await fixture();
    process.chdir(directory);
    const output = captureStdout();
    vi.resetModules();
    vi.doMock('../check/thread', () => ({
      async *runDiagnostics() {
        yield { kind: 'FILE_COUNT', fileCount: 0 };
      },
    }));
    const { CheckCommand } = await import('../check');
    const command = new CheckCommand();
    command.format = 'json';
    command.output = undefined;
    command.failOnWarn = false;
    command.minSeverity = 'info';
    command.tsconfig = undefined;
    process.exitCode = 123;

    const exit = await command.execute();
    const report = JSON.parse(output());
    expect(exit).toBe(0);
    expect(process.exitCode).toBe(0);
    expect(report).toMatchObject({
      schemaVersion: 1,
      command: 'check',
      success: true,
    });
  });

  it('returns structured check diagnostics and a non-zero exit code', async () => {
    vi.stubEnv('CI', '1');
    const directory = await fixture();
    process.chdir(directory);
    const output = captureStdout();
    vi.resetModules();
    vi.doMock('../check/thread', () => ({
      async *runDiagnostics() {
        yield { kind: 'FILE_COUNT', fileCount: 1 };
        yield {
          kind: 'FILE_DIAGNOSTICS',
          filePath: path.join(directory, 'src', 'query.ts'),
          messages: [
            {
              severity: 'error',
              message: 'Unknown field "missing".',
              file: path.join(directory, 'src', 'query.ts'),
              line: 3,
              col: 5,
              endLine: 3,
              endColumn: 12,
            },
          ],
        };
      },
    }));
    const { CheckCommand } = await import('../check');
    const command = new CheckCommand();
    command.format = 'json';
    command.output = undefined;
    command.failOnWarn = false;
    command.minSeverity = 'info';
    command.tsconfig = undefined;

    expect(await command.execute()).toBe(1);
    const text = output();
    expect(text).not.toMatch(/\x1b\[/);
    const report = JSON.parse(text);
    expect(report).toMatchObject({
      schemaVersion: 1,
      command: 'check',
      success: false,
      summary: { info: 0, warn: 0, error: 1 },
      diagnostics: [
        {
          severity: 'error',
          message: 'Unknown field "missing".',
          file: path.join('src', 'query.ts'),
          line: 3,
          column: 5,
        },
      ],
      error: { exitCode: 1 },
    });
  });

  it('falls back to stdout when machine output file cannot be written', async () => {
    vi.stubEnv('CI', '1');
    const directory = await fixture();
    process.chdir(directory);
    const output = captureStdout();
    await fs.mkdir(path.join(directory, 'reports'));
    vi.resetModules();
    vi.doMock('../check/thread', () => ({
      async *runDiagnostics() {
        yield { kind: 'FILE_COUNT', fileCount: 0 };
      },
    }));
    const { CheckCommand } = await import('../check');
    const command = new CheckCommand();
    command.format = 'json';
    command.output = './reports';
    command.failOnWarn = false;
    command.minSeverity = 'info';
    command.tsconfig = undefined;

    const exit = await command.execute();
    const report = JSON.parse(output());
    expect(exit).toBe(1);
    expect(report).toMatchObject({
      schemaVersion: 1,
      command: 'check',
      success: false,
      error: { exitCode: 1 },
    });
    expect(report.error.message).toContain('Failed to write JSON report');
  });

  it('writes check JSON to a file without human terminal output', async () => {
    vi.stubEnv('CI', '1');
    const directory = await fixture();
    process.chdir(directory);
    const output = captureStdout();
    vi.resetModules();
    vi.doMock('../check/thread', () => ({
      async *runDiagnostics() {
        yield { kind: 'FILE_COUNT', fileCount: 0 };
      },
    }));
    const { CheckCommand } = await import('../check');
    const command = new CheckCommand();
    command.format = 'json';
    command.output = './reports/check.json';
    command.failOnWarn = false;
    command.minSeverity = 'info';
    command.tsconfig = undefined;

    const exit = await command.execute();
    expect(output()).toBe('');
    const report = JSON.parse(
      await fs.readFile(path.join(directory, 'reports/check.json'), 'utf8')
    );
    expect(exit).toBe(0);
    expect(report).toMatchObject({
      schemaVersion: 1,
      command: 'check',
      success: true,
      summary: { info: 0, warn: 0, error: 0 },
    });
    expect(report.projects).toHaveLength(1);
    expect(report.diagnostics).toEqual([]);
  });
});
