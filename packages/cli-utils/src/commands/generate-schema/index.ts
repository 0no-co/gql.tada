import * as t from 'typanion';
import { Command, Option } from 'clipanion';

import type { Options } from './runner';
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

export async function generateSchema(opts: Options) {
  const tty = initTTY({ disableTTY: true });
  const result = await tty.start(run(tty, opts));
  if (result instanceof Error) {
    throw result;
  }
}
