import * as path from 'node:path';
import { parse } from '@0no-co/graphql.web';

import { SpanMapFeature, SpanMapKind } from './protocol';
import type { MapperDiagnostic, SpanMapping, TransformResult } from './protocol';

export interface TransformOptions {
  /** Absolute path of the `.graphql` file being transformed. */
  fileName: string;
  /** Module specifier of the user's `graphql()` function, as it'd be imported from `fileName`. */
  graphqlModule: string;
  /** Export name of the user's `graphql()` function.
   * @defaultValue `'graphql'`
   */
  graphqlExport?: string;
}

export const enum DiagnosticCode {
  SyntaxError = 1,
  UnknownFragment = 2,
  DuplicateName = 3,
  AnonymousOperation = 4,
  FragmentCycle = 5,
}

interface Token {
  value: string;
  start: number;
}

interface Definition {
  kind: 'fragment' | 'operation';
  start: number;
  end: number;
  name: Token | null;
  spreads: Token[];
}

interface ImportComment {
  path: string;
  /** Quoted specifier in the original comment */
  specifier: Token;
  /** Imported fragment names, or `null` for a wildcard import */
  names: Token[] | null;
}

interface Scan {
  definitions: Definition[];
  imports: ImportComment[];
  /** Whether the document contains type system definitions (i.e. SDL) */
  hasTypeSystem: boolean;
}

const EXECUTABLE_KEYWORDS = new Set(['query', 'mutation', 'subscription', 'fragment']);

// GraphQL names that aren't valid as binding identifiers
const RESERVED_WORDS = new Set(
  (
    'arguments await break case catch class const continue debugger default delete do else enum eval ' +
    'export extends false finally for function if implements import in instanceof interface let new ' +
    'null package private protected public return static super switch this throw true try typeof ' +
    'undefined var void while with yield'
  ).split(' ')
);

// `# import "./file.graphql"` (graphql-tag/loader) or `# import A, B from "./file.graphql"` (graphql-import)
const importRe = /^\s*import\s+(?:([\w\s,*]+?)\s+from\s+)?(["'])([^"'\n]+)\2/d;
const nameRe = /[_A-Za-z][_0-9A-Za-z]*/y;

const scan = (input: string): Scan => {
  const definitions: Definition[] = [];
  const imports: ImportComment[] = [];
  let hasTypeSystem = false;
  let current: Definition | null = null;
  let depth = 0;
  let idx = 0;

  const readName = (): Token | null => {
    // Skip ignored tokens between punctuators and names
    while (idx < input.length) {
      const char = input.charCodeAt(idx);
      if (char === 35 /*'#'*/) {
        while (idx < input.length && input[idx] !== '\n' && input[idx] !== '\r') idx++;
      } else if (char === 32 || char === 9 || char === 10 || char === 13 || char === 44) {
        idx++;
      } else {
        break;
      }
    }
    nameRe.lastIndex = idx;
    const match = nameRe.exec(input);
    if (!match) return null;
    idx = nameRe.lastIndex;
    return { value: match[0], start: match.index };
  };

  while (idx < input.length) {
    const char = input[idx];
    if (char === '#') {
      const start = idx;
      while (idx < input.length && input[idx] !== '\n' && input[idx] !== '\r') idx++;
      const match = depth === 0 && !current && importRe.exec(input.slice(start + 1, idx));
      if (match) {
        const offset = start + 1;
        const [listStart] = match.indices![1] || [0];
        const [specifierStart, specifierEnd] = match.indices![3]!;
        let names: Token[] | null = null;
        if (match[1] && match[1].trim() !== '*') {
          names = [];
          const nameListRe = /[_A-Za-z][_0-9A-Za-z]*/g;
          let name: RegExpExecArray | null;
          while ((name = nameListRe.exec(match[1])))
            names.push({ value: name[0], start: offset + listStart + name.index });
        }
        // The specifier token includes its quotes
        const specifier = {
          value: input.slice(offset + specifierStart - 1, offset + specifierEnd + 1),
          start: offset + specifierStart - 1,
        };
        imports.push({ path: match[3], specifier, names });
      }
    } else if (input.startsWith('"""', idx)) {
      idx += 3;
      while (idx < input.length && !input.startsWith('"""', idx))
        idx += input.startsWith('\\"""', idx) ? 4 : 1;
      idx += 3;
    } else if (char === '"') {
      idx++;
      while (idx < input.length && input[idx] !== '"' && input[idx] !== '\n')
        idx += input[idx] === '\\' ? 2 : 1;
      idx++;
    } else if (input.startsWith('...', idx)) {
      idx += 3;
      const name = readName();
      if (current && name && name.value !== 'on') current.spreads.push(name);
    } else if (char === '@' || char === '$') {
      idx++;
      readName();
    } else if (char === '{' || char === '(' || char === '[') {
      if (depth === 0 && char === '{' && !current && !hasTypeSystem) {
        // Anonymous query shorthand, e.g. `{ field }`
        current = { kind: 'operation', start: idx, end: idx, name: null, spreads: [] };
      }
      depth++;
      idx++;
    } else if (char === '}' || char === ')' || char === ']') {
      depth = Math.max(depth - 1, 0);
      idx++;
      // Variable defaults are nested in parentheses, so only a selection set closes at depth 0
      if (depth === 0 && char === '}' && current) {
        current.end = idx;
        definitions.push(current);
        current = null;
      }
    } else if (depth === 0 && !current && /[_A-Za-z]/.test(char)) {
      const keyword = readName()!;
      if (EXECUTABLE_KEYWORDS.has(keyword.value)) {
        const kind = keyword.value === 'fragment' ? 'fragment' : 'operation';
        current = { kind, start: keyword.start, end: idx, name: null, spreads: [] };
        const restore = idx;
        const name = readName();
        if (name && (kind === 'fragment' || name.value !== 'on')) {
          current.name = name;
        } else {
          idx = restore;
        }
      } else {
        // Any other top-level name starts a type system definition or extension
        hasTypeSystem = true;
      }
    } else {
      idx++;
    }
  }

  return { definitions, imports, hasTypeSystem };
};

const toIdentifier = (name: string) => (RESERVED_WORDS.has(name) ? `$${name}` : name);

const toSpecifier = (from: string, to: string) => {
  const relative = path.relative(path.dirname(from), to).split(path.sep).join('/');
  return relative.startsWith('.') ? relative : `./${relative}`;
};

/** Resolves a `graphql` module option relative to the tsconfig into a specifier for `fileName`. */
export const resolveGraphQLModule = (
  configFileName: string,
  fileName: string,
  graphqlModule: string
): string => {
  if (!graphqlModule.startsWith('.')) return graphqlModule;
  const rootPath = configFileName ? path.dirname(configFileName) : process.cwd();
  return toSpecifier(fileName, path.resolve(rootPath, graphqlModule));
};

const IDENTIFIER_FEATURES =
  SpanMapFeature.Hover |
  SpanMapFeature.Definition |
  SpanMapFeature.TypeDefinition |
  SpanMapFeature.References |
  SpanMapFeature.DocumentHighlights;

interface Writer {
  text: string;
  mappings: SpanMapping[];
  write(text: string): Writer;
  alias(text: string, original: Token, features: SpanMapFeature): Writer;
  /** Writes `input.slice(start, end)` as a template literal, mapping all unescaped runs verbatim */
  template(input: string, start: number, end: number): Writer;
}

const createWriter = (): Writer => {
  const out: Writer = {
    text: '',
    mappings: [],
    write(text) {
      out.text += text;
      return out;
    },
    alias(text, original, features) {
      out.mappings.push([
        out.text.length,
        text.length,
        original.start,
        original.value.length,
        SpanMapKind.Alias,
        features,
      ]);
      out.text += text;
      return out;
    },
    template(input, start, end) {
      out.text += '`';
      let runStart = start;
      const flush = (runEnd: number) => {
        if (runEnd > runStart) {
          out.mappings.push([
            out.text.length,
            runEnd - runStart,
            runStart,
            runEnd - runStart,
            SpanMapKind.Verbatim,
            SpanMapFeature.None,
          ]);
          out.text += input.slice(runStart, runEnd);
        }
      };
      for (let idx = start; idx < end; idx++) {
        const char = input[idx];
        if (char === '`' || char === '\\' || (char === '$' && input[idx + 1] === '{')) {
          flush(idx);
          out.text += `\\${char}`;
          runStart = idx + 1;
        }
      }
      flush(end);
      out.text += '`';
      return out;
    },
  };
  return out;
};

/** Transforms a GraphQL document into a TypeScript module exporting typed `graphql()` documents.
 *
 * @remarks
 * Every operation and fragment definition becomes a separate `graphql()` call, named after
 * the definition, and receives the fragments it spreads as dependencies. Fragments defined in
 * other files are imported with `# import` comments.
 */
export const transform = (content: string, options: TransformOptions): TransformResult => {
  const { definitions, imports, hasTypeSystem } = scan(content);
  const diagnostics: MapperDiagnostic[] = [];
  const out = createWriter();

  // Comment-only documents are valid here, but rejected by `parse`
  if (!hasTypeSystem && /[^\s,\ufeff]/.test(content.replace(/#[^\n\r]*/g, ''))) {
    try {
      parse(content, { noLocation: true });
    } catch (error: any) {
      const message = `${(error && error.message) || error}`;
      const match = /^(.*?) at (\d+) in (\w+)$/.exec(message);
      diagnostics.push({
        messageText: match ? `${match[1]} (expected ${match[3]})` : message,
        start: match ? Math.min(+match[2], content.length) : 0,
        length: 0,
        code: DiagnosticCode.SyntaxError,
      });
    }
  }

  if (!definitions.length) {
    out.write('export {};\n');
    return { text: out.text, extension: '.ts', mappings: out.mappings, diagnostics };
  }

  // Fragments that are resolved from the current file or named imports
  const bindings = new Map<string, string>();

  const fragments = new Map<string, Definition>();
  const exportNames = new Set<string>();
  const exported: Definition[] = [];
  let operations = 0;
  for (const definition of definitions) {
    if (definition.kind === 'operation') operations++;
    const { name } = definition;
    if (!name) {
      if (operations > 1 || definitions.some((other) => other.kind === 'operation' && other.name)) {
        diagnostics.push({
          messageText: 'This anonymous operation must be the only defined operation.',
          start: definition.start,
          length: 0,
          code: DiagnosticCode.AnonymousOperation,
        });
      } else {
        exported.push(definition);
      }
    } else if (exportNames.has(name.value)) {
      diagnostics.push({
        messageText: `There can be only one definition named "${name.value}" in a document.`,
        start: name.start,
        length: name.value.length,
        code: DiagnosticCode.DuplicateName,
      });
    } else {
      exportNames.add(name.value);
      exported.push(definition);
      if (definition.kind === 'fragment') {
        fragments.set(name.value, definition);
        bindings.set(name.value, toIdentifier(name.value));
      }
    }
  }

  out
    .write(`import { ${options.graphqlExport || 'graphql'} as $graphql } from `)
    .write(`${JSON.stringify(options.graphqlModule)};\n`);

  const wildcards: string[] = [];
  for (const importComment of imports) {
    const specifier = JSON.stringify(importComment.path);
    if (importComment.names) {
      const names = importComment.names.filter((name) => !bindings.has(name.value));
      if (!names.length) continue;
      out.write('import { ');
      names.forEach((name, index) => {
        const identifier = toIdentifier(name.value);
        bindings.set(name.value, identifier);
        if (index) out.write(', ');
        out.alias(name.value, name, IDENTIFIER_FEATURES);
        if (identifier !== name.value) out.write(` as ${identifier}`);
      });
      out.write(' } from ');
    } else {
      const identifier = `$import${wildcards.length}`;
      wildcards.push(identifier);
      out.write(`import * as ${identifier} from `);
    }
    out.alias(specifier, importComment.specifier, SpanMapFeature.Definition).write(';\n');
  }

  let namespace: string | null = null;
  if (wildcards.length === 1) {
    namespace = wildcards[0];
  } else if (wildcards.length > 1) {
    namespace = '$imports';
    out.write(`const $imports = { ...${wildcards.join(', ...')} };\n`);
  }

  // Emit fragments before their dependents, since `const` bindings can't be used before they're declared
  const ordered: Definition[] = [];
  const visiting = new Set<Definition>();
  const visit = (definition: Definition) => {
    if (ordered.includes(definition)) return;
    if (visiting.has(definition)) {
      const { name } = definition;
      diagnostics.push({
        messageText: `Cannot spread fragment "${name!.value}" within itself.`,
        start: name!.start,
        length: name!.value.length,
        code: DiagnosticCode.FragmentCycle,
      });
      return;
    }
    visiting.add(definition);
    for (const spread of definition.spreads) {
      const fragment = fragments.get(spread.value);
      if (fragment) visit(fragment);
    }
    visiting.delete(definition);
    ordered.push(definition);
  };
  exported.forEach(visit);

  for (const definition of ordered) {
    const { name } = definition;
    const identifier = name && toIdentifier(name.value);
    if (!name) {
      out.write('export default ');
    } else if (identifier === name.value) {
      out.write('export const ').alias(name.value, name, IDENTIFIER_FEATURES).write(' = ');
    } else {
      out.write(`const ${identifier} = `);
    }

    out.write('$graphql(').template(content, definition.start, definition.end);

    const seen = new Set<string>();
    const dependencies = definition.spreads.filter((spread) => {
      if (seen.has(spread.value)) return false;
      seen.add(spread.value);
      if (bindings.has(spread.value) || namespace) return true;
      diagnostics.push({
        messageText: `Unknown fragment "${spread.value}". Define it in this file or import it with a "# import" comment.`,
        start: spread.start,
        length: spread.value.length,
        code: DiagnosticCode.UnknownFragment,
      });
      return false;
    });

    if (dependencies.length) {
      out.write(', [');
      dependencies.forEach((spread, index) => {
        if (index) out.write(', ');
        const binding = bindings.get(spread.value);
        if (binding) {
          out.alias(binding, spread, IDENTIFIER_FEATURES);
        } else {
          out.write(`${namespace}.`).alias(spread.value, spread, IDENTIFIER_FEATURES);
        }
      });
      out.write(']');
    }

    out.write(');\n');
    if (name && identifier !== name.value) {
      out
        .write(`export { ${identifier} as `)
        .alias(name.value, name, IDENTIFIER_FEATURES)
        .write(' };\n');
    }
  }

  return { text: out.text, extension: '.ts', mappings: out.mappings, diagnostics };
};
