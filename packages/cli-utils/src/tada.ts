import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { IntrospectionQuery } from 'graphql';

import {
  type SchemaOrigin,
  minifyIntrospection,
  outputIntrospectionFile,
  load,
} from '@gql.tada/internal';

/**
 * This function mimics the behavior of the LSP, this so we can ensure
 * that gql.tada will work in any environment. The JetBrains IDE's do not
 * implement the tsserver plugin protocol hence in those and editors where
 * we are not able to leverage the workspace TS version we will rely on
 * this function.
 */
export async function ensureTadaIntrospection(
  origin: SchemaOrigin,
  outputLocation: string,
  base: string = process.cwd(),
  shouldPreprocess = true
) {
  const loader = load({ origin, rootPath: base });

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
