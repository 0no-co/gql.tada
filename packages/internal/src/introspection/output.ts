import type { IntrospectionQuery } from 'graphql';
import type { IntrospectionResult } from '../loaders';

import { TadaError } from '../errors';
import { PREAMBLE_IGNORE, ANNOTATION_DTS, ANNOTATION_TS } from './constants';
import { preprocessIntrospection, preprocessIntrospectionTypes } from './preprocess';

const TYPES_VAR = 'introspection_types';

const stringifyJson = (input: unknown | string): string =>
  typeof input === 'string' ? input : JSON.stringify(input, null, 2);

const ANNOTATION_SIGNATURE = 'An IntrospectionQuery representation';

/** Extracts the leading comment header of a previously generated file, so it
 * can be preserved across regenerations. Returns `null` when no custom header
 * is present (or when only the generated annotation remains). */
export function extractIntrospectionHeader(contents: string): string | null {
  const lines = contents.split('\n');
  const header: string[] = [];
  let inBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (inBlock) {
      header.push(line);
      if (trimmed.includes('*/')) inBlock = false;
    } else if (trimmed === '') {
      break;
    } else if (trimmed.startsWith('//')) {
      header.push(line);
    } else if (trimmed.startsWith('/*')) {
      header.push(line);
      if (!trimmed.includes('*/')) inBlock = true;
    } else {
      break;
    }
  }
  if (!header.length || inBlock) return null;
  const result = header.join('\n');
  if (result.includes(ANNOTATION_SIGNATURE)) return null;
  return result + '\n';
}

interface OutputIntrospectionFileOptions {
  fileType: '.ts' | '.d.ts' | string;
  shouldPreprocess?: boolean;
  /** A custom leading comment header used in place of the default preamble,
   * typically extracted from a prior file via `extractIntrospectionHeader`. */
  preamble?: string;
}

export function outputIntrospectionFile(
  introspection: IntrospectionQuery | IntrospectionResult,
  opts: OutputIntrospectionFileOptions
): string {
  const preamble = opts.preamble || PREAMBLE_IGNORE;
  if (/\.d\.ts$/.test(opts.fileType)) {
    const out = [preamble];
    if (typeof introspection !== 'string' && opts.shouldPreprocess) {
      // NOTE: When types aren't exported separately, composite tsconfigs
      // will output a serialization error in diagnostics
      out.push(
        `export type ${TYPES_VAR} = ${preprocessIntrospectionTypes(introspection)};\n`,
        ANNOTATION_DTS,
        `export type introspection = ${preprocessIntrospection(introspection, TYPES_VAR)};\n`,
        `import * as gqlTada from 'gql.tada';\n`
      );
    } else {
      out.push(
        ANNOTATION_DTS,
        `export type introspection = ${stringifyJson(introspection)};\n`,
        "import * as gqlTada from 'gql.tada';\n"
      );
    }
    // NOTE: When the `name` option is used and multiple schemas are present,
    // we omit the automatic schema declaration and rely on the user calling
    // `initGraphQLTada()` themselves
    if (!('name' in introspection) || !introspection.name) {
      out.push(
        "declare module 'gql.tada' {",
        '  interface setupSchema {',
        '    introspection: introspection',
        '  }',
        '}'
      );
    }
    return out.join('\n');
  } else if (/\.ts$/.test(opts.fileType)) {
    const json = stringifyJson(introspection);
    return [
      preamble,
      ANNOTATION_TS,
      `const introspection = ${json} as const;\n`,
      'export { introspection };',
    ].join('\n');
  }

  throw new TadaError(
    `No available introspection format for "${opts.fileType}" (expected ".ts" or ".d.ts")`
  );
}
