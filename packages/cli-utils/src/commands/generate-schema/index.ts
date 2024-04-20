import * as t from 'typanion';
import { Command, Option } from 'clipanion';

import type { SchemaOptions } from './runner';
import { initTTY } from '../../term';
import { run } from './runner';

const isHeaderEntries = t.isArray(t.cascade(t.isString(), t.matchesRegExp(/^[\w-]+[ ]*:[ ]*.+/i)));

const parseHeaders = (
  headers: readonly string[] | undefined
): Record<string, string> | undefined => {
  if (headers && headers.length) {
    return (headers || []).reduce((headers, entry) => {
      const index = entry.indexOf(':');
      const key = entry.slice(0, index);
      const value = entry.slice(index + 1);
      headers[key.trimEnd()] = value.trimStart();
      return headers;
    }, {});
  }
};

export class GenerateSchema extends Command {
  static paths = [['generate-schema'], ['generate', 'schema']];

  input = Option.String({
    name: 'schema',
    required: true,
  });

  tsconfig = Option.String('--tsconfig,-c', {
    description: 'Specify the `tsconfig.json` used to read, unless `--output` is passed.',
  });

  output = Option.String('--output,-o', {
    description:
      "Specify where to output the file to.\tDefault: The `schema` configuration option, if it's a file path",
  });

  headers = Option.Array('--header', {
    description: 'Headers to be used when introspection a schema from a remote URL',
    validator: isHeaderEntries,
  });

  async execute() {
    const tty = initTTY();
    const result = await tty.start(
      run(tty, {
        input: this.input,
        headers: parseHeaders(this.headers),
        output: this.output,
        tsconfig: this.tsconfig,
      })
    );
    return process.exitCode || (typeof result === 'object' ? result.exit : 0);
  }
}

/** Generates a GraphQL SDL file from a given GraphQL API URL or schema file.
 *
 * @remarks
 * Introspects a targeted GraphQL API by URL, a `.graphql` SDL or introspection
 * JSON file, and outputs a `.graphql` SDL file.
 *
 * @see {@link https://gql-tada.0no.co/reference/gql-tada-cli#generateschema}
 */
export async function generateSchema(opts: SchemaOptions) {
  const tty = initTTY({ disableTTY: true });
  const result = await tty.start(run(tty, opts));
  if (result instanceof Error) {
    throw result;
  }
}
