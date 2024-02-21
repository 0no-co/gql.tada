import { promises as fs } from 'node:fs';
import path from 'node:path';
import { buildSchema, introspectionFromSchema } from 'graphql';
import { minifyIntrospectionQuery } from '@urql/introspection';

export const tadaGqlContents = `import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './introspection';

export const graphql = initGraphQLTada<{
  introspection: typeof introspection;
}>();

export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada';
export type { FragmentOf as FragmentType } from 'gql.tada';
export { readFragment } from 'gql.tada';
export { readFragment as useFragment } from 'gql.tada';
`;

/**
 * This function mimics the behavior of the LSP, this so we can ensure
 * that gql.tada will work in any environment. The JetBrains IDE's do not
 * implement the tsserver plugin protocol hence in those and editors where
 * we are not able to leverage the workspace TS version we will rely on
 * this function.
 */
export async function ensureTadaIntrospection(schemaLocation: string, outputLocation: string) {
  const base = process.cwd();
  const writeTada = async () => {
    try {
      const content = await fs.readFile(schemaLocation, 'utf-8');
      const schema = buildSchema(content);
      const introspection = introspectionFromSchema(schema, {
        descriptions: false,
      });
      const minified = minifyIntrospectionQuery(introspection, {
        includeDirectives: false,
        includeEnums: true,
        includeInputs: true,
        includeScalars: true,
      });

      const json = JSON.stringify(minified, null, 2);
      const resolvedOutputLocation = path.resolve(base, outputLocation);
      const contents = [
        preambleComments,
        tsAnnotationComment,
        `const introspection = ${json} as const;\n`,
        'export { introspection };',
      ].join('\n');

      await fs.writeFile(resolvedOutputLocation, contents);
    } catch (e) {
      console.error('Something went wrong while writing the introspection file', e);
    }
  };

  await writeTada();
}

const preambleComments = ['/* eslint-disable */', '/* prettier-ignore */'].join('\n') + '\n';

const tsAnnotationComment = [
  '/** An IntrospectionQuery representation of your schema.',
  ' *',
  ' * @remarks',
  ' * This is an introspection of your schema saved as a file by GraphQLSP.',
  ' * You may import it to create a `graphql()` tag function with `gql.tada`',
  ' * by importing it and passing it to `initGraphQLTada<>()`.',
  ' *',
  ' * @example',
  ' * ```',
  " * import { initGraphQLTada } from 'gql.tada';",
  " * import type { introspection } from './introspection';",
  ' *',
  ' * export const graphql = initGraphQLTada<{',
  ' *   introspection: typeof introspection;',
  ' *   scalars: {',
  ' *     DateTime: string;',
  ' *     Json: any;',
  ' *   };',
  ' * }>();',
  ' * ```',
  ' */',
].join('\n');
