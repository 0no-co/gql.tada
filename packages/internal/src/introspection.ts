import type { IntrospectionQuery, IntrospectionType } from 'graphql';

import { minifyIntrospectionQuery } from '@urql/introspection';

import { PREAMBLE_IGNORE, ANNOTATION_DTS, ANNOTATION_TS } from './constants';
import { TadaError } from './errors';

const stringifyJson = (input: unknown | string): string =>
  typeof input === 'string' ? input : JSON.stringify(input, null, 2);
const stringifyName = (input: string | undefined | null): string =>
  input ? `"${input}"` : 'never';

export function minifyIntrospection(introspection: IntrospectionQuery): IntrospectionQuery {
  return minifyIntrospectionQuery(introspection, {
    includeDirectives: false,
    includeEnums: true,
    includeInputs: true,
    includeScalars: true,
  });
}

const stringifyObjectType = (object: Record<string, string>) => {
  let output = '';
  for (const key in object) output += `${stringifyName(key)}: ${object[key]}; `;
  return `{ ${output}}`;
};

const stringifyTupleType = (tuple: Array<string | Record<string, string>>) => {
  let output = '';
  for (const value of tuple)
    output += `${typeof value === 'string' ? value : stringifyObjectType(value)}}, `;
  return `[ ${output}]`;
};

export const printIntrospectionType = (type: IntrospectionType) => {
  if (type.kind === 'ENUM') {
    return stringifyObjectType({
      kind: stringifyName(type.kind),
      name: stringifyName(type.name),
      type: type.enumValues.map((value) => stringifyName(value.name)).join(' | '),
    });
  } else if (type.kind === 'INPUT_OBJECT') {
    return stringifyObjectType({
      kind: stringifyName(type.kind),
      name: stringifyName(type.name),
      inputFields: stringifyTupleType(
        type.inputFields.map((inputField) => JSON.stringify(inputField))
      ),
    });
  } else if (type.kind === 'OBJECT') {
    return stringifyObjectType({
      kind: stringifyName(type.kind),
      name: stringifyName(type.name),
      fields: stringifyObjectType(
        type.fields.reduce((object, field) => {
          object[field.name] = JSON.stringify(field);
          return object;
        }, {})
      ),
    });
  } else if (type.kind === 'INTERFACE') {
    return stringifyObjectType({
      kind: stringifyName(type.kind),
      name: stringifyName(type.name),
      possibleTypes: type.possibleTypes.map((value) => stringifyName(value.name)).join(' | '),
      fields: stringifyObjectType(
        type.fields.reduce((object, field) => {
          object[field.name] = JSON.stringify(field);
          return object;
        }, {})
      ),
    });
  } else if (type.kind === 'UNION') {
    return stringifyObjectType({
      kind: stringifyName(type.kind),
      name: stringifyName(type.name),
      possibleTypes: type.possibleTypes.map((value) => stringifyName(value.name)).join(' | '),
      fields: '{}',
    });
  } else if (type.kind === 'SCALAR') {
    return 'unknown';
  } else {
    return 'never';
  }
};

export async function preprocessIntrospection({
  __schema: schema,
}: IntrospectionQuery): Promise<string> {
  const queryName = stringifyName(schema.queryType.name);
  const mutationName = stringifyName(schema.mutationType && schema.mutationType.name);
  const subscriptionName = stringifyName(schema.subscriptionType && schema.subscriptionType.name);

  let evaluatedTypes = '';
  for (const type of schema.types) {
    const typeStr = printIntrospectionType(type);
    evaluatedTypes += `    "${type.name}": ${typeStr};\n`;
  }

  return (
    '{\n' +
    `  query: ${queryName};\n` +
    `  mutation: ${mutationName};\n` +
    `  subscription: ${subscriptionName};\n` +
    `  types: {\n${evaluatedTypes}  };\n}`
  );
}

interface OutputIntrospectionFileOptions {
  fileType: '.ts' | '.d.ts' | string;
  shouldPreprocess?: boolean;
}

export async function outputIntrospectionFile(
  introspection: IntrospectionQuery | string,
  opts: OutputIntrospectionFileOptions
): Promise<string> {
  if (/\.d\.ts$/.test(opts.fileType)) {
    const json =
      typeof introspection !== 'string' && opts.shouldPreprocess
        ? await preprocessIntrospection(introspection)
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
