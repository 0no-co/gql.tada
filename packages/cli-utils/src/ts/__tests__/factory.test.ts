import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import ts from 'typescript';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../transformers', () => ({
  transformExtensions: [] as const,
  transform: vi.fn(),
}));

describe('programFactory', () => {
  it('uses the requested project tsconfig when the plugin is declared in an extended config', async () => {
    const workspacePath = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'gql-tada-factory-'))
    );

    try {
      const { loadConfig } = await import('../../../../internal/src/resolve');
      const { programFactory } = await import('../factory');
      const baseConfigPath = path.join(workspacePath, 'tsconfig.base.json');
      const projectPath = path.join(workspacePath, 'packages', 'project');
      const projectConfigPath = path.join(projectPath, 'tsconfig.app.json');
      const projectEntryPath = path.join(projectPath, 'src', 'index.ts');
      const otherPackagePath = path.join(workspacePath, 'packages', 'other', 'src', 'index.ts');

      await fs.mkdir(path.dirname(projectEntryPath), { recursive: true });
      await fs.mkdir(path.dirname(otherPackagePath), { recursive: true });

      await Promise.all([
        fs.writeFile(
          baseConfigPath,
          JSON.stringify(
            {
              compilerOptions: {
                baseUrl: '.',
                plugins: [
                  {
                    name: '@0no-co/graphqlsp',
                    schema: './schema.graphql',
                    tadaOutputLocation: './src/graphql-env.d.ts',
                  },
                ],
              },
            },
            null,
            2
          )
        ),
        fs.writeFile(
          projectConfigPath,
          JSON.stringify(
            {
              extends: '../../tsconfig.base.json',
              include: ['src/index.ts'],
            },
            null,
            2
          )
        ),
        fs.writeFile(projectEntryPath, 'export const project = 1;\n'),
        fs.writeFile(otherPackagePath, 'export const other = 1;\n'),
      ]);

      const configResult = await loadConfig(projectConfigPath);
      const factory = programFactory(configResult);

      expect(configResult.configPath).toBe(baseConfigPath);
      expect(configResult.tsconfigPath).toBe(projectConfigPath);
      expect(configResult.rootPath).toBe(projectPath);
      expect(factory.rootFileNames).toEqual([projectEntryPath]);
      expect(factory.projectDirectories).toEqual([projectPath, path.dirname(projectEntryPath)]);
    } finally {
      await fs.rm(workspacePath, { recursive: true, force: true });
    }
  });

  it('inherits module resolution from extended tsconfig files', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'gql-tada-factory-'));

    try {
      const { programFactory } = await import('../factory');
      const configPath = path.join(rootPath, 'tsconfig.json');
      const indexPath = path.join(rootPath, 'src', 'index.ts');
      await fs.mkdir(path.join(rootPath, 'node_modules', '@acme', 'rig'), { recursive: true });
      await fs.mkdir(path.join(rootPath, 'src'), { recursive: true });

      await Promise.all([
        fs.writeFile(
          path.join(rootPath, 'package.json'),
          JSON.stringify(
            {
              name: 'fixture',
              type: 'module',
              imports: {
                '#*': './src/*',
              },
            },
            null,
            2
          )
        ),
        fs.writeFile(
          path.join(rootPath, 'node_modules', '@acme', 'rig', 'tsconfig.json'),
          JSON.stringify(
            {
              compilerOptions: {
                module: 'nodenext',
                moduleResolution: 'nodenext',
              },
            },
            null,
            2
          )
        ),
        fs.writeFile(
          configPath,
          JSON.stringify(
            {
              extends: '@acme/rig/tsconfig.json',
              include: ['src/**/*'],
            },
            null,
            2
          )
        ),
        fs.writeFile(path.join(rootPath, 'src', 'tada.ts'), 'export const graphql = () => null;\n'),
        fs.writeFile(indexPath, "import { graphql } from '#tada.ts';\ngraphql();\n"),
      ]);

      const factory = programFactory({ rootPath, configPath });
      const program = factory.build().program;
      const sourceFile = program.getSourceFile(indexPath)!;
      const diagnostics = program
        .getSemanticDiagnostics(sourceFile)
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));

      expect(factory.wasOriginallyNodeNext).toBe(true);
      expect(diagnostics).toEqual([]);
    } finally {
      await fs.rm(rootPath, { recursive: true, force: true });
    }
  });

  it('keeps root file names scoped to the parsed tsconfig inputs', async () => {
    const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'gql-tada-factory-'));

    try {
      const { programFactory } = await import('../factory');
      const configPath = path.join(rootPath, 'tsconfig.json');
      const entryPath = path.join(rootPath, 'src', 'entry.ts');
      const importedPath = path.join(rootPath, 'src', 'imported.ts');
      const outsidePath = path.join(rootPath, 'outside-rootdir', 'outside.ts');

      await fs.mkdir(path.join(rootPath, 'src'), { recursive: true });
      await fs.mkdir(path.join(rootPath, 'outside-rootdir'), { recursive: true });

      await Promise.all([
        fs.writeFile(
          configPath,
          JSON.stringify(
            {
              compilerOptions: {
                rootDir: 'src',
                module: 'esnext',
                moduleResolution: 'bundler',
              },
              include: ['src/entry.ts'],
            },
            null,
            2
          )
        ),
        fs.writeFile(
          entryPath,
          "import './imported';\nimport '../outside-rootdir/outside';\nexport const entry = 1;\n"
        ),
        fs.writeFile(importedPath, 'export const imported = 1;\n'),
        fs.writeFile(outsidePath, 'export const outside = 1;\n'),
      ]);

      const factory = programFactory({ rootPath, configPath });
      const container = factory.build();
      const programFileNames = container.getSourceFiles().map((file) => file.fileName);

      expect(factory.rootFileNames).toContain(entryPath);
      expect(factory.rootFileNames).not.toContain(importedPath);
      expect(factory.rootFileNames).not.toContain(outsidePath);
      expect(programFileNames).toContain(importedPath);
      expect(programFileNames).toContain(outsidePath);
    } finally {
      await fs.rm(rootPath, { recursive: true, force: true });
    }
  });
});
