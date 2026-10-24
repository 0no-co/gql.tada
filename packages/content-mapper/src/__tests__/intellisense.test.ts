import { describe, it, expect } from 'vitest';

import { transform } from '../transform';
import { parseDefinition } from '../intellisense';
import { DiagnosticDirectivePolicy, SpanMapFeature, SpanMapKind } from '../protocol';
import type { TransformResult } from '../protocol';

const run = (content: string, options: { ignoreIntellisenseErrors?: boolean } = {}) =>
  transform(content, {
    fileName: '/project/src/queries.graphql',
    graphqlModule: './graphql',
    intellisense: true,
    ...options,
  });

/** The mappings that participate in completions, with the text they connect */
const fieldSpans = (content: string, result: TransformResult) =>
  (result.mappings || [])
    .filter(([, , , , , features]) => features! & SpanMapFeature.Completion)
    .map(([virtualStart, virtualLength, originalStart, originalLength, kind]) => ({
      virtual: result.text.slice(virtualStart, virtualStart + virtualLength),
      original: content.slice(originalStart, originalStart + originalLength),
      kind,
    }));

describe('parseDefinition', () => {
  it('reads fields, aliases and inline fragments, skipping arguments and directives', () => {
    const content =
      'query Q($limit: Int = 10) @live { renamed: pokemons(filter: { a: [1] }, limit: $limit) @include(if: true) { id ...Item ... on Pokemon { name } ... @skip(if: false) { weight } } }';
    const definition = parseDefinition(content, 0, content.length)!;
    expect(definition.root).toBe('query');
    const [field] = definition.selections;
    expect(field).toMatchObject({ kind: 'field', name: { value: 'pokemons' } });
    expect(field.kind === 'field' && field.selections).toMatchObject([
      { kind: 'field', name: { value: 'id' }, selections: null },
      {
        kind: 'inline',
        typeCondition: { value: 'Pokemon' },
        selections: [{ kind: 'field', name: { value: 'name' } }],
      },
      {
        kind: 'inline',
        typeCondition: null,
        selections: [{ kind: 'field', name: { value: 'weight' } }],
      },
    ]);
  });

  it('uses the type condition of fragments as their root', () => {
    const content = 'fragment Item on Pokemon { id }';
    expect(parseDefinition(content, 0, content.length)).toMatchObject({
      root: { value: 'Pokemon', start: content.indexOf('Pokemon') },
      selections: [{ name: { value: 'id' } }],
    });
  });

  it('tolerates unclosed selection sets', () => {
    const content = 'mutation { addPokemon { na';
    expect(parseDefinition(content, 0, content.length)).toMatchObject({
      root: 'mutation',
      selections: [{ name: { value: 'addPokemon' }, selections: [{ name: { value: 'na' } }] }],
    });
  });
});

describe('transform with intellisense', () => {
  it('leaves the output unchanged by default', () => {
    const content = 'query A { a { b } }\n';
    const result = transform(content, {
      fileName: '/project/a.graphql',
      graphqlModule: './graphql',
    });
    expect(result.text).not.toContain('declare const');
    expect(result.diagnosticDirectives).toBeUndefined();
  });

  it('lowers selections into ambient property accesses', () => {
    const content = [
      'query Pokemons {',
      '  pokemons { id ... on Pokemon { name } }',
      '}',
      'fragment Item on Pokemon { weight { minimum } }',
      '',
    ].join('\n');
    const result = run(content);
    expect(result.diagnostics).toEqual([]);
    expect(result.text.slice(result.text.indexOf('declare const $0'))).toMatchInlineSnapshot(`
      "declare const $0: $Root<"query">;
      declare const $1: $Of<typeof $0.pokemons>;
      declare const $2: $Of<typeof $1.id>;
      declare const $3: typeof $types.Pokemon;
      declare const $4: $Of<typeof $3.name>;
      declare const $5: typeof $types.Pokemon;
      declare const $6: $Of<typeof $5.weight>;
      declare const $7: $Of<typeof $6.minimum>;
      "
    `);
    // Only the helpers that are used are declared, since `noUnusedLocals` reports unused types
    expect(result.text).toContain(
      "import type { GraphQLTadaAPI as $GraphQLTadaAPI } from 'gql.tada';"
    );
    expect(result.text).toContain('type $TypeMap');
    expect(result.text).not.toContain('type $On');
  });

  it('maps field names and type conditions verbatim onto the document', () => {
    const content = 'query A { alias: pokemons { ... on Pokemon { name } } }\n';
    const result = run(content);
    expect(fieldSpans(content, result)).toEqual([
      { virtual: 'pokemons', original: 'pokemons', kind: SpanMapKind.Verbatim },
      { virtual: 'Pokemon', original: 'Pokemon', kind: SpanMapKind.Verbatim },
      { virtual: 'name', original: 'name', kind: SpanMapKind.Verbatim },
    ]);
    // Mappings must stay ordered by their virtual position
    const starts = result.mappings!.map(([virtualStart]) => virtualStart);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('only ignores TypeScript errors on lowered selections when asked to', () => {
    const content = 'query A { a }\n';
    expect(run(content).diagnosticDirectives).toBeUndefined();
    const result = run(content, { ignoreIntellisenseErrors: true });
    const [[originalStart, , virtualStart, virtualEnd, policy]] =
      result.diagnosticDirectives!.directives;
    expect(originalStart).toBe(-1);
    expect(policy).toBe(DiagnosticDirectivePolicy.Ignore);
    expect(result.text.slice(virtualStart, virtualEnd)).toMatchInlineSnapshot(`
      "declare const $0: $Root<"query">;
      declare const $1: $Of<typeof $0.a>;
      "
    `);
  });

  it('skips the scaffolding for documents without selections', () => {
    expect(run('# import * from "./other.graphql"\n').text).not.toContain('$GraphQLTadaAPI');
  });
});
