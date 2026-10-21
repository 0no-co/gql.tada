import * as path from 'node:path';
import { describe, it, expect } from 'vitest';

import { transform, resolveGraphQLModule, DiagnosticCode } from '../transform';
import { SpanMapKind } from '../protocol';
import type { TransformResult } from '../protocol';

const run = (content: string) =>
  transform(content, { fileName: '/project/src/queries.graphql', graphqlModule: './graphql' });

/** Resolves every mapping into the virtual and original text it connects */
const spans = (content: string, result: TransformResult) =>
  (result.mappings || []).map(
    ([virtualStart, virtualLength, originalStart, originalLength, kind]) => ({
      virtual: result.text.slice(virtualStart, virtualStart + virtualLength),
      original: content.slice(originalStart, originalStart + originalLength),
      kind,
    })
  );

describe('transform', () => {
  it('exports each definition and orders fragments before their dependents', () => {
    const content = [
      'query GetPokemons {',
      '  pokemons { ...PokemonItem }',
      '}',
      '',
      'fragment PokemonItem on Pokemon {',
      '  id',
      '  ...Name',
      '}',
      '',
      'fragment Name on Pokemon { name }',
      '',
    ].join('\n');
    const result = run(content);
    expect(result.diagnostics).toEqual([]);
    expect(result.extension).toBe('.ts');
    expect(result.text).toMatchInlineSnapshot(`
      "import { graphql as $graphql } from "./graphql";
      export const Name = $graphql(\`fragment Name on Pokemon { name }\`);
      export const PokemonItem = $graphql(\`fragment PokemonItem on Pokemon {
        id
        ...Name
      }\`, [Name]);
      export const GetPokemons = $graphql(\`query GetPokemons {
        pokemons { ...PokemonItem }
      }\`, [PokemonItem]);
      "
    `);
  });

  it('maps documents verbatim and identifiers to their GraphQL names', () => {
    const content = 'query A { ...F }\nfragment F on T { b }\n';
    const result = run(content);
    for (const span of spans(content, result)) {
      if (span.kind === SpanMapKind.Verbatim) {
        expect(span.virtual).toBe(span.original);
      } else {
        expect(span.original).toBe(span.virtual);
      }
    }
    expect(spans(content, result).map((span) => span.original)).toEqual([
      'F',
      'fragment F on T { b }',
      'A',
      'query A { ...F }',
      'F',
    ]);
  });

  it('escapes template literal syntax and keeps mapping the surrounding text', () => {
    const content = 'query A { a(x: "`${b}` \\n") }\n';
    const result = run(content);
    expect(result.text).toContain('$graphql(`query A { a(x: "\\`\\${b}\\` \\\\n") }`)');
    const verbatim = spans(content, result).filter((span) => span.kind === SpanMapKind.Verbatim);
    expect(verbatim.map((span) => span.virtual)).toEqual(['query A { a(x: "', '{b}', ' ', 'n") }']);
    for (const span of verbatim) expect(span.virtual).toBe(span.original);
  });

  it('imports named fragments from graphql-import comments', () => {
    const content = [
      '# import Fields, Other from "./fields.graphql"',
      'query A { ...Fields }',
    ].join('\n');
    const result = run(content);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain('import { Fields, Other } from "./fields.graphql";');
    expect(result.text).toContain('[Fields]');
    const aliased = spans(content, result).filter((span) => span.kind === SpanMapKind.Alias);
    expect(aliased.map((span) => span.original)).toEqual([
      'Fields',
      'Other',
      '"./fields.graphql"',
      'A',
      'Fields',
    ]);
  });

  it('resolves unknown spreads through wildcard imports', () => {
    const single = run('#import "./a.graphql"\nquery A { ...F }');
    expect(single.text).toContain('import * as $import0 from "./a.graphql";');
    expect(single.text).toContain('[$import0.F]');

    const multiple = run(
      '#import \'./a.graphql\'\n# import * from "./b.graphql"\nquery A { ...F }'
    );
    expect(multiple.text).toContain('const $imports = { ...$import0, ...$import1 };');
    expect(multiple.text).toContain('[$imports.F]');
    expect(multiple.diagnostics).toEqual([]);
  });

  it('ignores import comments inside definitions', () => {
    const result = run('query A {\n  #import "./a.graphql"\n  a\n}');
    expect(result.text).not.toContain('from "./a.graphql"');
  });

  it('renames definitions named after reserved words', () => {
    const result = run('query delete { a }\n');
    expect(result.text).toContain('const $delete = $graphql(');
    expect(result.text).toContain('export { $delete as delete };');
  });

  it('exports a lone anonymous operation as the default export', () => {
    expect(run('{ a }').text).toContain('export default $graphql(`{ a }`);');
    expect(run('query ($id: ID) { a(id: $id) }').text).toContain('export default $graphql(');
  });

  it('handles variable defaults and directives on definitions', () => {
    const content = 'query A($x: In = { a: "}" }) @dir(b: [1]) { a }\nfragment F on T @dir { b }';
    const result = run(content);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain('`query A($x: In = { a: "}" }) @dir(b: [1]) { a }`');
    expect(result.text).toContain('`fragment F on T @dir { b }`');
  });

  it('reports unknown fragments at their spreads', () => {
    const content = 'query A { ...Missing ... on T { b } ... @skip(if: true) { c } }';
    const result = run(content);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: DiagnosticCode.UnknownFragment,
        start: content.indexOf('Missing'),
        length: 'Missing'.length,
      }),
    ]);
    expect(result.text).toContain('`);');
  });

  it('reports duplicate names, extra anonymous operations, and fragment cycles', () => {
    const duplicates = run('query A { a }\nfragment A on T { b }');
    expect(duplicates.diagnostics).toEqual([
      expect.objectContaining({ code: DiagnosticCode.DuplicateName, start: 23 }),
    ]);

    const anonymous = run('{ a }\nquery B { b }');
    expect(anonymous.diagnostics).toEqual([
      expect.objectContaining({ code: DiagnosticCode.AnonymousOperation, start: 0 }),
    ]);

    const cycle = run('fragment A on T { ...B }\nfragment B on T { ...A }');
    expect(cycle.diagnostics).toEqual([
      expect.objectContaining({ code: DiagnosticCode.FragmentCycle }),
    ]);
  });

  it('reports syntax errors', () => {
    const result = run('query A {\n  a(\n}');
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: DiagnosticCode.SyntaxError }),
    ]);
  });

  it('emits unclosed definitions, so they can be completed while typing', () => {
    const result = run('fragment F on T { a }\nquery A {\n  b {\n    ...F');
    expect(result.text).toContain('export const A = $graphql(`query A {\n  b {\n    ...F`, [F]);');
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: DiagnosticCode.SyntaxError }),
    ]);
  });

  it('emits empty modules for schema definitions and comment-only documents', () => {
    const schema = run('"""Description"""\ntype Query {\n  a: Int\n}\nscalar Date\n');
    expect(schema).toMatchObject({ text: 'export {};\n', diagnostics: [] });
    const comments = run('# nothing here\n');
    expect(comments).toMatchObject({ text: 'export {};\n', diagnostics: [] });
  });
});

describe('resolveGraphQLModule', () => {
  it('resolves relative modules from the tsconfig to the transformed file', () => {
    const configFileName = path.resolve('/project/tsconfig.json');
    const fileName = path.resolve('/project/src/queries/pokemon.graphql');
    expect(resolveGraphQLModule(configFileName, fileName, './src/graphql.ts')).toBe(
      '../graphql.ts'
    );
    expect(resolveGraphQLModule(configFileName, fileName, './src/queries/graphql')).toBe(
      './graphql'
    );
  });

  it('passes non-relative modules through', () => {
    expect(resolveGraphQLModule('/project/tsconfig.json', '/a.graphql', '~/graphql')).toBe(
      '~/graphql'
    );
  });
});
