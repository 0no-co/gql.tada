import type { IntrospectionQuery } from 'graphql';

import { TypeFormatFlags } from 'typescript';
import { minifyIntrospectionQuery } from '@urql/introspection';

import { PREAMBLE_IGNORE, ANNOTATION_DTS, ANNOTATION_TS } from './constants';
import { TSError, TadaError } from './errors';

import {
  createVirtualHost,
  importLib,
  importModule,
  resolveModuleFile,
  createProgram,
} from './vfs';

const ROOT_FILE = 'index.ts';
const ALIAS_PREFIX = '$__';

const BUILDER_FLAGS =
  TypeFormatFlags.NoTruncation |
  TypeFormatFlags.NoTypeReduction |
  TypeFormatFlags.InTypeAlias |
  TypeFormatFlags.UseFullyQualifiedType |
  TypeFormatFlags.GenerateNamesForShadowedTypeParams;

const stringifyJson = (input: unknown | string): string =>
  typeof input === 'string' ? input : JSON.stringify(input, null, 2);
const stringifyName = (input: string | undefined | null): string =>
  input ? JSON.stringify(input) : 'never';

export function minifyIntrospection(introspection: IntrospectionQuery): IntrospectionQuery {
  return minifyIntrospectionQuery(introspection, {
    includeDirectives: false,
    includeEnums: true,
    includeInputs: true,
    includeScalars: true,
  });
}

async function createHost(evaluateFile: string) {
  const host = createVirtualHost();
  await importLib(host);
  await importModule(host, '@0no-co/graphql.web');
  host.writeFile('gql-tada.ts', await resolveModuleFile('gql.tada/dist/gql-tada.d.ts'));
  host.writeFile(ROOT_FILE, evaluateFile);
  return host;
}

export async function preprocessIntrospection({
  __schema: schema,
}: IntrospectionQuery): Promise<string> {
  const queryName = stringifyName(schema.queryType.name);
  const mutationName = stringifyName(schema.mutationType && schema.mutationType.name);
  const subscriptionName = stringifyName(schema.subscriptionType && schema.subscriptionType.name);

  // TODO: We'd love for this to be just evaluated from `mapIntrospection` instead
  // However, currently TypeScript seems to have hard limits in both the printer and checker for how
  // many types are evaluated inside large object types.
  // A fix/hack to get TypeScript to output the entire type would be preferable to splitting printing
  // up here.
  let evaluateFile = 'import type { __mapType } from "./gql-tada.ts";\n';
  for (const type of schema.types) {
    evaluateFile += `export type ${ALIAS_PREFIX + type.name} = __mapType<${JSON.stringify(
      type
    )}>;\n`;
  }

  const host = await createHost(evaluateFile);
  const program = createProgram([ROOT_FILE], host);
  const checker = program.getTypeChecker();
  const diagnostics = program.getSemanticDiagnostics();
  const root = program.getSourceFile(ROOT_FILE);
  const rootSymbol = root && checker.getSymbolAtLocation(root);
  if (diagnostics.length || !rootSymbol)
    throw new TSError('TypeScript failed to evaluate introspection', diagnostics);

  let evaluatedTypes = '';
  for (const exportSymbol of checker.getExportsOfModule(rootSymbol)) {
    const declaration = exportSymbol && exportSymbol.declarations && exportSymbol.declarations[0];
    const type = declaration && checker.getTypeAtLocation(declaration);
    if (!type) throw new TSError('Something went wrong while evaluating introspection type.');
    const typeStr = checker.typeToString(type, undefined, BUILDER_FLAGS).trim();
    const nameStr = exportSymbol.name.slice(ALIAS_PREFIX.length);
    evaluatedTypes += `    ${stringifyName(nameStr)}: ${typeStr};\n`;
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
