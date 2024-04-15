import { Command, Option } from 'clipanion';

import type { Options } from './runner';
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

  async execute() {
    // TODO: Add verbose/log/list/debug/trace option that outputs discovered documents (by name) per file
    const tty = initTTY();
    const result = await tty.start(
      run(tty, {
        failOnWarn: this.failOnWarn,
        output: this.output,
        tsconfig: this.tsconfig,
      })
    );
    return process.exitCode || (typeof result === 'object' ? result.exit : 0);
  }
}

export async function generateTurbo(opts: Options) {
  const tty = initTTY({ disableTTY: true });
  const result = await tty.start(run(tty, opts));
  if (result instanceof Error) {
    throw result;
  }
}
