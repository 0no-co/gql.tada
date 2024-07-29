import type { IntrospectionQuery } from 'graphql';
import type { IntrospectionResult } from '../loaders';

import { TadaError } from '../errors';
import { PREAMBLE_IGNORE, ANNOTATION_DTS, ANNOTATION_TS } from './constants';
import { preprocessIntrospection, preprocessIntrospectionTypes } from './preprocess';

const TYPES_VAR = 'introspection_types';

const stringifyJson = (input: unknown | string): string =>
  typeof input === 'string' ? input : JSON.stringify(input, null, 2);

interface OutputIntrospectionFileOptions {
  fileType: '.ts' | '.d.ts' | string;
  shouldPreprocess?: boolean;
}

export function outputIntrospectionFile(
  introspection: IntrospectionQuery | IntrospectionResult,
  opts: OutputIntrospectionFileOptions
): string {
  if (/\.d\.ts$/.test(opts.fileType)) {
    const out = [PREAMBLE_IGNORE, ANNOTATION_DTS];
    if (typeof introspection !== 'string' && opts.shouldPreprocess) {
      // NOTE: When types aren't exported separately, composite tsconfigs
      // will output a serialization error in diagnostics
      out.push(
        `export type ${TYPES_VAR} = ${preprocessIntrospectionTypes(introspection)};\n`,
        `export type introspection = ${preprocessIntrospection(introspection, TYPES_VAR)};\n`,
        `import * as gqlTada from 'gql.tada';\n`
      );
    } else {
      out.push(
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
      PREAMBLE_IGNORE,
      ANNOTATION_TS,
      `const introspection = ${json} as const;\n`,
      'export { introspection };',
    ].join('\n');
  }

  throw new TadaError(
    `No available introspection format for "${opts.fileType}" (expected ".ts" or ".d.ts")`
  );
}
