import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API } from 'typescript-native/unstable/sync';
import { isIdentifier, isVariableDeclaration } from 'typescript-native/unstable/ast/is';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { version: typescriptVersion } = require('typescript-native/package.json');
const fixtureDir = path.join(root, 'scripts/typescript-71-compat');
const configFile = path.join(fixtureDir, 'tsconfig.json');
const sourceFileName = path.join(fixtureDir, 'index.ts');

const api = new API({ cwd: root });
let snapshot;

try {
  assert.match(typescriptVersion, /^7\.1\./);
  snapshot = api.updateSnapshot({ openProjects: [configFile] });
  const project = snapshot.getProject(configFile);
  assert(project, 'TypeScript 7.1 did not load the compatibility fixture');

  const source = project.program.getSourceFile(sourceFileName);
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

  assert.equal(
    resultType,
    '{ todos: ({ id: string; text: string; } | null)[] | null; }',
    'ResultOf inference changed under the TypeScript 7.1 native API'
  );

  const diagnostics = project.program.getSemanticDiagnostics(sourceFileName);
  assert.equal(diagnostics.length, 1, 'Expected the fixture semantic error to be reported');
  assert.equal(diagnostics[0].code, 2322);
  assert.equal(source.text.slice(diagnostics[0].pos, diagnostics[0].end), 'text');

  console.log(
    `TypeScript ${typescriptVersion} native API compatibility passed: ResultOf inferred and semantic diagnostic ${diagnostics[0].code} reported.`
  );
} finally {
  snapshot?.dispose();
  api.close();
}
