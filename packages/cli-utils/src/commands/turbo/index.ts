import { Command, Option } from 'clipanion';

import type { TurboOptions } from './runner';
import { exitCode } from '../../utils/error';
import { initTTY } from '../../term';
import { run } from './runner';

export class TurboCommand extends Command {
  static paths = [['generate', 'turbo'], ['turbo']];

  tsconfig = Option.String('--tsconfig,-c', {
    description: 'Specify the `tsconfig.json` read for configuration.',
  });

  failOnWarn = Option.Boolean('--fail-on-warn,-w', false, {
    description: 'Triggers an error and a non-zero exit code if any warnings have been reported',
  });

  output = Option.String('--output,-o', {
    description:
      'Specifies where to output the file to.\tDefault: The `tadaTurboLocation` configuration option',
  });

  skipUnchanged = Option.Boolean('--skip-unchanged', false, {
    description: 'Skip cache regeneration when no GraphQL files have changed',
  });

  async execute() {
    // TODO: Add verbose/log/list/debug/trace option that outputs discovered documents (by name) per file
    const tty = initTTY();
    const result = await tty.start(
      run(tty, {
        failOnWarn: this.failOnWarn,
        output: this.output,
        tsconfig: this.tsconfig,
        skipUnchanged: this.skipUnchanged,
      })
    );
    return exitCode() || (typeof result === 'object' ? result.exit : 0);
  }
}

/** Generates a cache typings file for all GraphQL document types ahead of time.
 *
 * @remarks
 * The `generateTurbo()` function generates a cache for all GraphQL document types ahead of time.
 * This cache speeds up type evaluation and is especially useful when it's checked into the
 * repository after making changes to GraphQL documents, which speeds up all further type
 * checks and evaluation.
 *
 * @see {@link https://gql-tada.0no.co/reference/gql-tada-cli#generateturbo}
 */
export async function generateTurbo(opts: TurboOptions) {
  const tty = initTTY({ disableTTY: true });
  const result = await tty.start(run(tty, opts));
  if (result instanceof Error) {
    throw result;
  }
}
