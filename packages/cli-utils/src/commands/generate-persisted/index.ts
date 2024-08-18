import { Command, Option } from 'clipanion';

import type { PersistedOptions } from './runner';
import { exitCode } from '../../utils/error';
import { initTTY } from '../../term';
import { run } from './runner';

export class GeneratePersisted extends Command {
  static paths = [['generate-persisted'], ['generate', 'persisted']];

  tsconfig = Option.String('--tsconfig,-c', {
    description: 'Specify the `tsconfig.json` used to read, unless `--output` is passed.',
  });

  disableNormalization = Option.Boolean('--disable-normalization', false, {
    description: 'Disables normalizing of GraphQL documents (parsing then printing documents)',
  });

  failOnWarn = Option.Boolean('--fail-on-warn', false, {
    description: 'Triggers an error and a non-zero exit code if any warnings have been reported',
  });

  output = Option.String('--output,-o', {
    description:
      'Specifies where to output the file to.\tDefault: The `tadaPersistedLocation` configuration option',
  });

  async execute() {
    // TODO: Add verbose/log/list/debug/trace option that outputs discovered documents (by name) per file
    const tty = initTTY();
    const result = await tty.start(
      run(tty, {
        disableNormalization: this.disableNormalization,
        failOnWarn: this.failOnWarn,
        output: this.output,
        tsconfig: this.tsconfig,
      })
    );
    return exitCode() || (typeof result === 'object' ? result.exit : 0);
  }
}

/** Generates a JSON manifest file of all `graphql.persisted()` documents.
 *
 * @remarks
 * Scans your code for `graphql.persisted()` calls and generates a JSON
 * manifest file containing a mapping of document IDs to the GraphQL document strings.
 *
 * @see {@link https://gql-tada.0no.co/reference/gql-tada-cli#generatepersisted}
 */
export async function generatePersisted(opts: PersistedOptions) {
  const tty = initTTY({ disableTTY: true });
  const result = await tty.start(run(tty, opts));
  if (result instanceof Error) {
    throw result;
  }
}
