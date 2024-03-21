import type { IntrospectionQuery } from 'graphql';
import { minifyIntrospectionQuery } from '@urql/introspection';

import { TadaError } from '../errors';
import { PREAMBLE_IGNORE, ANNOTATION_DTS, ANNOTATION_TS } from './constants';
import { preprocessIntrospection } from './preprocess';

const stringifyJson = (input: unknown | string): string =>
  typeof input === 'string' ? input : JSON.stringify(input, null, 2);

export function minifyIntrospection(introspection: IntrospectionQuery): IntrospectionQuery {
  return minifyIntrospectionQuery(introspection, {
    includeDirectives: false,
    includeEnums: true,
    includeInputs: true,
    includeScalars: true,
  });
}

interface OutputIntrospectionFileOptions {
  fileType: '.ts' | '.d.ts' | string;
  shouldPreprocess?: boolean;
}

export function outputIntrospectionFile(
  introspection: IntrospectionQuery | string,
  opts: OutputIntrospectionFileOptions
): string {
  if (/\.d\.ts$/.test(opts.fileType)) {
    const json =
      typeof introspection !== 'string' && opts.shouldPreprocess
        ? preprocessIntrospection(introspection)
        : stringifyJson(introspection);
    return [
      PREAMBLE_IGNORE,
      ANNOTATION_DTS,
      `export type introspection = ${json};\n`,
      "import * as gqlTada from 'gql.tada';\n",
      "declare module 'gql.tada' {",
      '  interface setupSchema {',
      '    introspection: introspection',
      '  }',
      '}',
    ].join('\n');
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
