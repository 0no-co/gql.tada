import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { GraphQLSchema, IntrospectionQuery } from 'graphql';

import {
  buildClientSchema,
  buildSchema,
  getIntrospectionQuery,
  introspectionFromSchema,
} from 'graphql';

import { minifyIntrospection, outputIntrospectionFile } from '@gql.tada/internal';

/**
 * This function mimics the behavior of the LSP, this so we can ensure
 * that gql.tada will work in any environment. The JetBrains IDE's do not
 * implement the tsserver plugin protocol hence in those and editors where
 * we are not able to leverage the workspace TS version we will rely on
 * this function.
 */
export async function ensureTadaIntrospection(
  schemaLocation: SchemaOrigin,
  outputLocation: string,
  base: string = process.cwd(),
  shouldPreprocess = true
) {
  const writeTada = async () => {
    const schema = await loadSchema(base, schemaLocation);
    if (!schema) {
      console.error('Something went wrong while trying to load the schema.');
      return;
    }

    const introspection = minifyIntrospection(
      introspectionFromSchema(schema, {
        descriptions: false,
      })
    );

    const contents = await outputIntrospectionFile(introspection, {
      fileType: outputLocation,
      shouldPreprocess,
    });

    const resolvedOutputLocation = path.resolve(base, outputLocation);
    await fs.writeFile(resolvedOutputLocation, contents);
  };

  try {
    await writeTada();
  } catch (error) {
    console.error('Something went wrong while writing the introspection file', error);
  }
}

export type SchemaOrigin =
  | string
  | {
      url: string;
      headers: Record<string, unknown>;
    };

export const loadSchema = async (
  root: string,
  schema: SchemaOrigin
): Promise<GraphQLSchema | undefined> => {
  let url: URL | undefined;
  let config: { headers: Record<string, unknown> } | undefined;

  try {
    if (typeof schema === 'object') {
      url = new URL(schema.url);
      config = { headers: schema.headers };
    } else {
      url = new URL(schema);
    }
  } catch (e) {}

  if (url) {
    const response = await fetch(url!.toString(), {
      method: 'POST',
      headers: config
        ? {
            ...(config.headers || {}),
            'Content-Type': 'application/json',
          }
        : {
            'Content-Type': 'application/json',
          },
      body: JSON.stringify({
        query: getIntrospectionQuery({
          descriptions: true,
          schemaDescription: false,
          inputValueDeprecation: false,
          directiveIsRepeatable: false,
          specifiedByUrl: false,
        }),
      }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.data) {
        const introspection = (result as { data: IntrospectionQuery }).data;
        try {
          return buildClientSchema(introspection);
        } catch (e: any) {
          console.error(`Got schema error for ${e.message}`);
        }
      } else {
        console.error(`Got invalid response ${JSON.stringify(result)}`);
      }
    } else {
      console.error(`Got invalid response ${await response.text()}`);
    }
  } else if (typeof schema === 'string') {
    const isJson = path.extname(schema) === '.json';
    const resolvedPath = path.resolve(root, schema);

    const contents = await fs.readFile(resolvedPath, 'utf-8');

    const schemaOrIntrospection = isJson
      ? (JSON.parse(contents) as IntrospectionQuery)
      : buildSchema(contents);

    return '__schema' in schemaOrIntrospection
      ? buildClientSchema(schemaOrIntrospection)
      : schemaOrIntrospection;
  }
};
