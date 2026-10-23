import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildSchema } from 'graphql';

import { loadFromSDL, minifyIntrospection, outputIntrospectionFile } from '@gql.tada/internal';
import {
  SchemaDiagnosticCode,
  isSchemaDocument,
  transformSchema,
  validateDocument,
} from '../schema';

const sdl = [
  'type Todo {',
  '  id: ID!',
  '  text: String!',
  '  done: Boolean!',
  '}',
  '',
  'input TodoFilter {',
  '  done: Boolean',
  '}',
  '',
  'type Query {',
  '  todos(filter: TodoFilter): [Todo!]!',
  '}',
  '',
].join('\n');

const generateOutput = async (content: string, name?: string) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'content-mapper-'));
  const file = path.join(dir, 'schema.graphql');
  fs.writeFileSync(file, content);
  try {
    const { introspection } = await loadFromSDL({ file, name }).load();
    return outputIntrospectionFile(minifyIntrospection(introspection), {
      fileType: '.d.ts',
      shouldPreprocess: true,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

describe('transformSchema', () => {
  it('matches the generated output file, except for its unused namespace import', async () => {
    const result = transformSchema(sdl);
    expect(result.diagnostics).toEqual([]);
    expect(result.extension).toBe('.ts');
    expect(result.mappings).toEqual([]);
    const generated = await generateOutput(sdl);
    expect(generated).toContain("import * as gqlTada from 'gql.tada';\n");
    expect(result.text).toBe(generated.replace("import * as gqlTada from 'gql.tada';\n", ''));
    expect(result.text).toContain('interface setupSchema');
  });

  it('matches named schemas of multi-schema setups and omits the setupSchema augmentation', async () => {
    const result = transformSchema(sdl, { name: 'todos' });
    const generated = await generateOutput(sdl, 'todos');
    expect(result.text).toBe(generated.replace("import * as gqlTada from 'gql.tada';\n", ''));
    expect(result.text).not.toContain('setupSchema');
    expect(result.text).toContain("name: 'todos'");
  });

  it('can export the introspection type without augmenting setupSchema', () => {
    const result = transformSchema(sdl, { augmentSetupSchema: false });
    expect(result.text).toContain('export type introspection = ');
    expect(result.text).not.toContain('setupSchema');
  });

  it('reports syntax errors at their position', () => {
    const content = 'type Query {\n  todos: [Todo!\n}\n';
    const result = transformSchema(content);
    expect(result.text).toBe('export {};\n');
    expect(result.diagnostics).toMatchObject([{ code: SchemaDiagnosticCode.SchemaError }]);
    expect(result.diagnostics![0].messageText).toMatch(/Syntax Error/);
    expect(result.diagnostics![0].start).toBe(content.indexOf('}'));
  });

  it('reports SDL validation errors on the names they mention', () => {
    const content = 'type Query {\n  todo: Todo\n  user: User\n}\n';
    const result = transformSchema(content);
    expect(result.text).toBe('export {};\n');
    expect(
      result.diagnostics!.map((diagnostic) =>
        content.slice(diagnostic.start, diagnostic.start + diagnostic.length)
      )
    ).toEqual(['Todo', 'User']);
  });

  it('reports invalid schemas on the definitions they concern', () => {
    const content = 'interface Node { id: ID! }\ntype Query implements Node { name: String }\n';
    const result = transformSchema(content);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics![0].messageText).toMatch(/Node\.id/);
    const { start, length } = result.diagnostics![0];
    // The interface field that `Query` fails to implement
    expect(content.slice(start, start + length)).toBe('id');
  });
});

describe('isSchemaDocument', () => {
  it('detects schemas by their root types', () => {
    expect(isSchemaDocument(sdl)).toBe(true);
    expect(isSchemaDocument('schema { query: Root }\ntype Root { a: Int }')).toBe(true);
  });

  it('ignores partial SDL, executable documents and invalid syntax', () => {
    expect(isSchemaDocument('extend type Query { local: Boolean }')).toBe(false);
    expect(isSchemaDocument('type Todo { id: ID! }')).toBe(false);
    expect(isSchemaDocument('query { todos { id } }')).toBe(false);
    expect(isSchemaDocument('type Query {')).toBe(false);
  });
});

describe('validateDocument', () => {
  const schema = buildSchema(sdl);
  const locate = (content: string) =>
    validateDocument(content, schema).map((diagnostic) => ({
      code: diagnostic.code,
      text: content.slice(diagnostic.start, diagnostic.start + diagnostic.length),
      messageText: diagnostic.messageText,
    }));

  it('reports unknown fields on their name', () => {
    const content = 'query Todos {\n  todos {\n    id\n    doesNotExist\n  }\n}\n';
    expect(locate(content)).toEqual([
      {
        code: SchemaDiagnosticCode.ValidationError,
        text: 'doesNotExist',
        messageText: 'Cannot query field "doesNotExist" on type "Todo".',
      },
    ]);
  });

  it('reports variables of the wrong type', () => {
    const content = 'query Todos($filter: Boolean) {\n  todos(filter: $filter) { id }\n}\n';
    expect(locate(content)).toMatchObject([
      { messageText: expect.stringMatching(/Variable "\$filter" of type "Boolean"/) },
    ]);
  });

  it("doesn't report fragments that are exported or imported from other files", () => {
    expect(locate('fragment TodoItem on Todo { id text }\n')).toEqual([]);
    expect(locate('query Todos { todos { ...TodoItem } }\n')).toEqual([]);
  });

  it("doesn't report variables that may be used by imported fragments", () => {
    expect(locate('query Todos($done: Boolean) { todos { ...TodoItem } }\n')).toEqual([]);
    expect(locate('query Todos($done: Boolean) { todos { id } }\n')).toMatchObject([
      { messageText: expect.stringMatching(/never used/) },
    ]);
  });

  it('leaves syntax errors to the document transform', () => {
    expect(locate('query Todos { todos { id }\n')).toEqual([]);
  });
});
