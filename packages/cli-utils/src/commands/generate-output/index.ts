import { Command, Option } from 'clipanion';

import type { Options } from './runner';
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
    return process.exitCode || (typeof result === 'object' ? result.exit : 0);
  }
}

export async function generateOutput(opts: Options): Promise<void> {
  const tty = initTTY({ disableTTY: true });
  const result = await tty.start(run(tty, opts));
  if (result instanceof Error) {
    throw result;
  }
}
