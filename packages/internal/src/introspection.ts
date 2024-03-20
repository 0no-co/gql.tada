import type { IntrospectionQuery } from 'graphql';
import { EmitHint, NodeBuilderFlags, NewLineKind, createPrinter } from 'typescript';
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

const builderFlags =
  NodeBuilderFlags.NoTruncation |
  NodeBuilderFlags.GenerateNamesForShadowedTypeParams |
  NodeBuilderFlags.NoTypeReduction |
  NodeBuilderFlags.AllowEmptyTuple |
  NodeBuilderFlags.InObjectTypeLiteral |
  NodeBuilderFlags.InTypeAlias |
  NodeBuilderFlags.IgnoreErrors;

const boilerplateFile = `
  import type { introspection } from './introspection.ts';
  import type { mapIntrospection } from './gql-tada.ts';
  type obj<T> = T extends { [key: string | number]: any } ? { [K in keyof T]: T[K] } : never;
  export type output = obj<mapIntrospection<introspection>>;
`;

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

export async function preprocessIntrospection(introspection: IntrospectionQuery): Promise<string> {
  const json = JSON.stringify(introspection, null, 2);
  const introspectionFile = `export type introspection = ${json};`;

  const host = createVirtualHost();
  await importLib(host);
  await importModule(host, '@0no-co/graphql.web');
  host.writeFile('gql-tada.ts', await resolveModuleFile('gql.tada/dist/gql-tada.d.ts'));
  host.writeFile('introspection.ts', introspectionFile);
  host.writeFile('index.ts', boilerplateFile);

  const program = createProgram(['index.ts'], host);
  const checker = program.getTypeChecker();
  const diagnostics = program.getSemanticDiagnostics();
  if (diagnostics.length) {
    throw new TSError('TypeScript failed to evaluate introspection', diagnostics);
  }

  const root = program.getSourceFile('index.ts');
  const rootSymbol = root && checker.getSymbolAtLocation(root);
  const outputSymbol = rootSymbol && checker.getExportsOfModule(rootSymbol)[0];
  const declaration = outputSymbol && outputSymbol.declarations && outputSymbol.declarations[0];
  const type = declaration && checker.getTypeAtLocation(declaration);
  if (!type) {
    throw new TSError('Something went wrong while evaluating introspection type.');
  }

  const printer = createPrinter({
    newLine: NewLineKind.LineFeed,
    removeComments: true,
    omitTrailingSemicolon: true,
    noEmitHelpers: true,
  });

  const typeNode = checker.typeToTypeNode(type, declaration, builderFlags);
  if (!typeNode) {
    throw new TSError('Something went wrong while evaluating introspection type node.');
  }

  return printer.printNode(EmitHint.Unspecified, typeNode, root);
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
