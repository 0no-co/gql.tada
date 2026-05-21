import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { programFactory } from '../factory';

describe('programFactory', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('resolveConfig', () => {
    it('scopes file discovery to the project when configPath is a parent tsconfig', () => {
      // Reproduce the monorepo scenario: the gql.tada plugin is declared in a shared
      // tsconfig.base.json at the workspace root (so loadConfig returns configPath =
      // workspace root), but the actual project has its own tsconfig.json with a
      // narrowed `include`. Without the fix, TypeScript resolves `baseUrl` against the
      // workspace root and scans the entire monorepo.
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gql-tada-factory-'));

      // Workspace root: shared tsconfig with no include (would scan everything)
      const workspaceDir = path.join(tmpDir, 'workspace');
      fs.mkdirSync(workspaceDir);
      fs.writeFileSync(
        path.join(workspaceDir, 'tsconfig.base.json'),
        JSON.stringify({ compilerOptions: { strict: true } })
      );

      // A stray .ts file at workspace root that must NOT end up in the program
      fs.writeFileSync(path.join(workspaceDir, 'stray.ts'), 'export const x = 1;\n');

      // Project with its own tsconfig scoped to src/
      const projectDir = path.join(workspaceDir, 'packages', 'project');
      const srcDir = path.join(projectDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(projectDir, 'tsconfig.json'),
        JSON.stringify({ extends: '../../tsconfig.base.json', include: ['src'] })
      );
      fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export const value = 42;\n');

      // configPath = parent tsconfig (where plugin was found via `extends`)
      // rootPath  = the project directory (where `gql-tada check` was invoked)
      const factory = programFactory({
        configPath: path.join(workspaceDir, 'tsconfig.base.json'),
        rootPath: projectDir,
      });

      // Every scanned directory must be inside the project — the workspace root must
      // not appear, which it would if the parent tsconfig's baseUrl drove the scan.
      const dirs = factory.projectDirectories;
      expect(dirs.every((d) => d.startsWith(projectDir))).toBe(true);
    });
  });
});
