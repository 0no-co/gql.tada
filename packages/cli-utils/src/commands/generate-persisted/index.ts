import { Command, Option } from 'clipanion';

import { initTTY } from '../../term';
import { run } from './runner';

export class GeneratePersisted extends Command {
  static paths = [['generate-persisted'], ['generate', 'persisted']];

  tsconfig = Option.String('--tsconfig,-c', {
    description: 'Specify the `tsconfig.json` used to read, unless `--output` is passed.',
  });

  failOnWarn = Option.Boolean('--fail-on-warn,-w', false, {
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
        failOnWarn: this.failOnWarn,
        output: this.output,
        tsconfig: this.tsconfig,
      })
    );
    return process.exitCode || (typeof result === 'object' ? result.exit : 0);
  }
}
