import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { IntrospectionQuery } from 'graphql';
import type { SchemaLoader } from '@gql.tada/internal';

import {
  minifyIntrospection,
  outputIntrospectionFile,
  loadFromSDL,
  loadFromURL,
} from '@gql.tada/internal';

import type { SchemaOrigin } from './lsp';

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
  const loader = makeLoader(base, schemaLocation);

  let introspection: IntrospectionQuery | null;
  try {
    introspection = await loader.loadIntrospection();
  } catch (error) {
    console.error('Something went wrong while trying to load the schema.', error);
    return;
  }

  if (!introspection) {
    console.error('Could not retrieve introspection schema.');
    return;
  }

  try {
    const contents = outputIntrospectionFile(minifyIntrospection(introspection), {
      fileType: outputLocation,
      shouldPreprocess,
    });

    const resolvedOutputLocation = path.resolve(base, outputLocation);
    await fs.writeFile(resolvedOutputLocation, contents);
  } catch (error) {
    console.error('Something went wrong while writing the introspection file', error);
  }
}

const getURLConfig = (origin: SchemaOrigin) => {
  if (typeof origin === 'string') {
    try {
      return { url: new URL(origin) };
    } catch (_error) {
      return null;
    }
  } else if (typeof origin.url === 'string') {
    try {
      return {
        url: new URL(origin.url),
        headers: origin.headers,
      };
    } catch (error) {
      throw new Error(`Input URL "${origin.url}" is invalid`);
    }
  } else {
    return null;
  }
};

export function makeLoader(root: string, origin: SchemaOrigin): SchemaLoader {
  const urlOrigin = getURLConfig(origin);
  if (urlOrigin) {
    return loadFromURL(urlOrigin);
  } else if (typeof origin === 'string') {
    const file = path.resolve(root, origin);
    return loadFromSDL({ file, assumeValid: true });
  } else {
    throw new Error(`Configuration contains an invalid "schema" option`);
  }
}
