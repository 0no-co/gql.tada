import { Command, Option } from 'clipanion';

import type { OutputOptions } from './runner';
import { exitCode } from '../../utils/error';
import { initTTY } from '../../term';
import { run } from './runner';

export class GenerateOutputCommand extends Command {
  static paths = [['generate-output'], ['generate', 'output']];

  forceTSFormat = Option.Boolean('--force-ts-format', false, {
    description: 'Forces the `.ts` output format when the output is piped',
    hidden: true,
  });

  disablePreprocessing = Option.Boolean('--disable-preprocessing', false, {
    description:
      'Disables pre-processing, which is an internal introspection format generated ahead of time',
  });

  tsconfig = Option.String('--tsconfig,-c', {
    description: 'Specify the `tsconfig.json` used to read, unless `--output` is passed.',
  });

  output = Option.String('--output,-o', {
    description:
      'Specifies where to output the file to.\tDefault: The `tadaOutputLocation` configuration option',
  });

  async execute() {
    const tty = initTTY();
    const result = await tty.start(
      run(tty, {
        forceTSFormat: this.forceTSFormat,
        disablePreprocessing: this.disablePreprocessing,
        output: this.output,
        tsconfig: this.tsconfig,
      })
    );
    return exitCode() || (typeof result === 'object' ? result.exit : 0);
  }
}

/** Outputs the `gql.tada` output file manually.
 *
 * @remarks
 * Loads the schema from the specified `schema` configuration option and writes the output file
 * to the specified output location.
 *
 * @see {@link https://gql-tada.0no.co/reference/gql-tada-cli#generateoutput}
 */
export async function generateOutput(opts: OutputOptions): Promise<void> {
  const tty = initTTY({ disableTTY: true });
  const result = await tty.start(run(tty, opts));
  if (result instanceof Error) {
    throw result;
  }
}
