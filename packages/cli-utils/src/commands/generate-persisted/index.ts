import { Command, Option } from 'clipanion';

import { initTTY } from '../../term';
import { run } from './runner';

export class GeneratePersisted extends Command {
  static paths = [['generate-persisted'], ['generate', 'persisted']];

  tsconfig = Option.String('--tsconfig,-c', {
    description: 'Specify the `tsconfig.json` used to read, unless `--output` is passed.',
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
        output: this.output,
        tsconfig: this.tsconfig,
      })
    );
    return process.exitCode || (typeof result === 'object' ? result.exit : 0);
  }
}
