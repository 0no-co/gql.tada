import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API } from 'typescript-native/sync';
import { createFileSystemLayer } from 'typescript-native/fs';
import { isIdentifier, isVariableDeclaration } from 'typescript-native/ast/is';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { version: typescriptVersion } = require('typescript-native/package.json');
const configFile = path.join(root, 'scripts/typescript-71-compat/tsconfig.json');
const sourceFileName = path.join(root, 'scripts/typescript-71-compat/index.ts');
const api = new API({ cwd: root });
let before;
let after;
let beforeProgram;
let afterProgram;

try {
  assert.match(typescriptVersion, /^7\.1\./);
  before = api.createSnapshot({ openProjects: [configFile] });
  const project = before.getConfiguredProject(configFile);
  assert(project, 'TypeScript 7.1 did not load the compatibility fixture');
  beforeProgram = project.program;
  const source = beforeProgram.getSourceFile(sourceFileName);
  assert(source, 'TypeScript 7.1 did not expose the compatibility fixture source');
  let resultType;
  source.forEachChild(function visit(node) {
    if (
      isVariableDeclaration(node) &&
      isIdentifier(node.name) &&
      node.name.text === 'validResult'
    ) {
      resultType = project.checker.typeToString(project.checker.getTypeAtLocation(node.name));
    }
    node.forEachChild(visit);
  });
  assert.equal(resultType, '{ todos: ({ id: string; text: string; } | null)[] | null; }');
  const diagnostics = beforeProgram.getSemanticDiagnostics();
  assert.equal(diagnostics.length, 1, 'Expected only the intentional result assignment error');
  assert.equal(diagnostics[0].code, 2322);
  assert.equal(source.text.slice(diagnostics[0].pos, diagnostics[0].end), 'text');
  assert.equal(beforeProgram.getSyntacticDiagnostics().length, 0);
  assert.equal(beforeProgram.getGlobalDiagnostics().length, 0);
  assert.equal(beforeProgram.getProgramDiagnostics().length, 0);

  after = before.update({
    fileSystem: createFileSystemLayer([
      [sourceFileName, source.text.replace('text: 1', "text: 'fixed'")],
    ]),
    ensurePrograms: [beforeProgram.id],
  });
  afterProgram = after.getProgram(beforeProgram.id);
  assert(afterProgram, 'Updated program was not found');
  assert.equal(afterProgram.getSemanticDiagnostics().length, 0, 'Fix must clear the error');
  assert.equal(
    beforeProgram.getSemanticDiagnostics().length,
    1,
    'Prior snapshot must remain immutable'
  );
  console.log(
    `TypeScript ${typescriptVersion}: inference, masking, variables, abstract types, diagnostic mapping, and immutable snapshot update passed.`
  );
} finally {
  afterProgram?.dispose();
  after?.dispose();
  beforeProgram?.dispose();
  before?.dispose();
  api.close();
}
