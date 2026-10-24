// Lowers a definition's selection sets into type-only TypeScript, so that TypeScript itself
// offers completions, hover information and "unknown property" errors on GraphQL field names.
//
// Every selection set becomes an ambient `declare const` typed by its parent type's fields,
// and every field becomes a `typeof $parent.field` query on it, with the field name mapped
// verbatim onto the GraphQL token. Ambient declarations and types are erased from emitted
// output and aren't reported by `noUnusedLocals`.

export interface Token {
  value: string;
  start: number;
}

export type RootKind = 'query' | 'mutation' | 'subscription';

export interface FieldSelection {
  kind: 'field';
  /** The field name, i.e. not its alias */
  name: Token;
  selections: Selection[] | null;
}

export interface InlineFragmentSelection {
  kind: 'inline';
  typeCondition: Token | null;
  selections: Selection[];
}

export type Selection = FieldSelection | InlineFragmentSelection;

export interface LoweredDefinition {
  /** The root operation type, or the fragment's type condition */
  root: RootKind | Token;
  selections: Selection[];
}

type LexToken = { kind: 'name' | 'punct' | 'other'; value: string; start: number };

const nameRe = /[_A-Za-z][_0-9A-Za-z]*/y;

const lex = (input: string, start: number, end: number): LexToken[] => {
  const tokens: LexToken[] = [];
  let idx = start;
  while (idx < end) {
    const char = input[idx];
    const code = input.charCodeAt(idx);
    if (char === '#') {
      while (idx < end && input[idx] !== '\n' && input[idx] !== '\r') idx++;
    } else if (code === 32 || code === 9 || code === 10 || code === 13 || code === 44) {
      idx++;
    } else if (input.startsWith('"""', idx)) {
      const tokenStart = idx;
      idx += 3;
      while (idx < end && !input.startsWith('"""', idx))
        idx += input.startsWith('\\"""', idx) ? 4 : 1;
      idx = Math.min(idx + 3, end);
      tokens.push({ kind: 'other', value: input.slice(tokenStart, idx), start: tokenStart });
    } else if (char === '"') {
      const tokenStart = idx++;
      while (idx < end && input[idx] !== '"' && input[idx] !== '\n')
        idx += input[idx] === '\\' ? 2 : 1;
      idx = Math.min(idx + 1, end);
      tokens.push({ kind: 'other', value: input.slice(tokenStart, idx), start: tokenStart });
    } else if (input.startsWith('...', idx)) {
      tokens.push({ kind: 'punct', value: '...', start: idx });
      idx += 3;
    } else if ('{}()[]:@$=!|&'.includes(char)) {
      tokens.push({ kind: 'punct', value: char, start: idx });
      idx++;
    } else {
      nameRe.lastIndex = idx;
      const match = nameRe.exec(input);
      if (match && match.index + match[0].length <= end) {
        tokens.push({ kind: 'name', value: match[0], start: idx });
        idx += match[0].length;
      } else {
        // Numbers and stray characters only occur in arguments and are skipped
        const tokenStart = idx++;
        while (idx < end && /[-+.0-9eE]/.test(input[idx])) idx++;
        tokens.push({ kind: 'other', value: input.slice(tokenStart, idx), start: tokenStart });
      }
    }
  }
  return tokens;
};

/** Parses the selection sets of the definition in `input.slice(start, end)`.
 *
 * @remarks
 * This is a tolerant parser: it accepts unclosed selection sets (e.g. while a document is being
 * typed) and skips over anything it doesn't understand, since it only needs field names and type
 * conditions. Syntax errors are reported by `transform` itself.
 */
export const parseDefinition = (
  input: string,
  start: number,
  end: number
): LoweredDefinition | null => {
  const tokens = lex(input, start, end);
  let idx = 0;

  const peek = (value?: string) =>
    idx < tokens.length && (value == null || tokens[idx].value === value) ? tokens[idx] : null;

  const skipBalanced = () => {
    // Skips a parenthesized argument or variable list, starting at its `(`
    let depth = 0;
    while (idx < tokens.length) {
      const token = tokens[idx++];
      if (token.value === '(') depth++;
      else if (token.value === ')' && --depth <= 0) return;
    }
  };

  const skipDirectives = () => {
    while (peek('@')) {
      idx++;
      if (peek() && peek()!.kind === 'name') idx++;
      if (peek('(')) skipBalanced();
    }
  };

  const toToken = (token: LexToken): Token => ({ value: token.value, start: token.start });

  const parseSelectionSet = (): Selection[] => {
    const selections: Selection[] = [];
    idx++; // `{`
    while (idx < tokens.length) {
      const token = tokens[idx];
      if (token.value === '}') {
        idx++;
        break;
      } else if (token.value === '...') {
        idx++;
        let typeCondition: Token | null = null;
        if (peek('on')) {
          idx++;
          const next = peek();
          if (next && next.kind === 'name') {
            typeCondition = toToken(next);
            idx++;
          }
        } else if (peek() && peek()!.kind === 'name') {
          // A fragment spread is resolved by the `graphql()` call itself
          idx++;
          skipDirectives();
          continue;
        }
        skipDirectives();
        if (peek('{'))
          selections.push({ kind: 'inline', typeCondition, selections: parseSelectionSet() });
      } else if (token.kind === 'name') {
        idx++;
        let name = toToken(token);
        if (peek(':')) {
          idx++;
          const next = peek();
          if (next && next.kind === 'name') {
            name = toToken(next);
            idx++;
          }
        }
        if (peek('(')) skipBalanced();
        skipDirectives();
        selections.push({
          kind: 'field',
          name,
          selections: peek('{') ? parseSelectionSet() : null,
        });
      } else if (token.value === '{') {
        // A selection set without a field, e.g. after a syntax error; its fields are unknown
        parseSelectionSet();
      } else {
        idx++;
      }
    }
    return selections;
  };

  let root: LoweredDefinition['root'] = 'query';
  const first = peek();
  if (!first) return null;
  if (first.value === 'fragment') {
    idx++;
    if (peek() && peek()!.kind === 'name' && !peek('on')) idx++;
    if (!peek('on')) return null;
    idx++;
    const typeCondition = peek();
    if (!typeCondition || typeCondition.kind !== 'name') return null;
    root = toToken(typeCondition);
    idx++;
  } else if (
    first.value === 'query' ||
    first.value === 'mutation' ||
    first.value === 'subscription'
  ) {
    root = first.value;
    idx++;
    if (peek() && peek()!.kind === 'name') idx++;
    if (peek('(')) skipBalanced();
  } else if (first.value !== '{') {
    return null;
  }
  skipDirectives();
  if (!peek('{')) return null;
  return { root, selections: parseSelectionSet() };
};

/** Helper types for lowered selections, keyed by name, and the helpers each depends on. */
export const HELPERS = {
  $Types: {
    deps: [],
    text: 'type $Types = (typeof $graphql extends $GraphQLTadaAPI<infer Schema, any> ? Schema : never)["types"];\n',
  },
  $Root: {
    deps: ['$Types', '$Fields'],
    text: 'type $Root<Kind extends "query" | "mutation" | "subscription"> = $Fields<(typeof $graphql extends $GraphQLTadaAPI<infer Schema, any> ? Schema : never)[Kind]>;\n',
  },
  $Ref: {
    deps: [],
    text: 'type $Ref<T> = T extends { kind: "NON_NULL"; ofType: infer U } ? `${$Ref<U>}!` : T extends { kind: "LIST"; ofType: infer U } ? `[${$Ref<U>}]` : T extends { name: infer N extends string } ? N : never;\n',
  },
  $Named: {
    deps: [],
    text: 'type $Named<T> = T extends `${infer U}!` ? $Named<U> : T extends `[${infer U}]` ? $Named<U> : T;\n',
  },
  $Fields: {
    deps: ['$Types', '$Ref'],
    text: 'type $Fields<Name> = { __typename: "String!" } & (Name extends keyof $Types ? $Types[Name] extends { fields: infer F } ? { [K in keyof F]: F[K] extends { type: infer T } ? $Ref<T> : never } : {} : {});\n',
  },
  $types: {
    deps: ['$Types', '$Fields'],
    // Type conditions are property accesses (rather than string literals), so that the whole
    // node maps onto the type name, and unknown types are `any` and don't cascade into fields
    text: 'type $TypeMap = { [Name in keyof $Types]: $Fields<Name> };\ndeclare const $types: $TypeMap;\n',
  },
  $Of: {
    deps: ['$Fields', '$Named'],
    text: 'type $Of<Field> = $Fields<$Named<Field>>;\n',
  },
} satisfies Record<string, { deps: string[]; text: string }>;

export type HelperName = keyof typeof HELPERS;

/** Orders the used helpers and their dependencies, so that each is emitted once. */
export const resolveHelpers = (used: Set<HelperName>): HelperName[] => {
  const resolved = new Set<HelperName>();
  const visit = (name: HelperName) => {
    if (resolved.has(name)) return;
    resolved.add(name);
    for (const dep of HELPERS[name].deps) visit(dep as HelperName);
  };
  used.forEach(visit);
  return (Object.keys(HELPERS) as HelperName[]).filter((name) => resolved.has(name));
};
