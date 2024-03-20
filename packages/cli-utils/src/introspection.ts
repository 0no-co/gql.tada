import { EmitHint, NodeBuilderFlags, NewLineKind, createPrinter } from 'typescript';

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

export async function introspectionToSchemaType(introspectionJson: string): Promise<string> {
  const introspectionFile = `export type introspection = ${introspectionJson};`;

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
    throw new Error('TypeScript failed to evaluate introspection');
  }

  const root = program.getSourceFile('index.ts');
  const rootSymbol = root && checker.getSymbolAtLocation(root);
  const outputSymbol = rootSymbol && checker.getExportsOfModule(rootSymbol)[0];
  const declaration = outputSymbol && outputSymbol.declarations && outputSymbol.declarations[0];
  const type = declaration && checker.getTypeAtLocation(declaration);
  if (!type) {
    throw new Error('Something went wrong while evaluating introspection type.');
  }

  const printer = createPrinter({
    newLine: NewLineKind.LineFeed,
    removeComments: true,
    omitTrailingSemicolon: true,
    noEmitHelpers: true,
  });

  const typeNode = checker.typeToTypeNode(type, declaration, builderFlags);
  if (!typeNode) {
    throw new Error('Something went wrong while evaluating introspection type node.');
  }

  return printer.printNode(EmitHint.Unspecified, typeNode, root);
}
