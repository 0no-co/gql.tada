import { Command, Option } from 'clipanion';

import { initTTY } from '../../term';
import { run } from './runner';

export class GeneratePersisted extends Command {
  static paths = [['generate-persisted'], ['generate', 'persisted']];

  tsconfig = Option.String('--tsconfig,-c', {
    description: 'Specify the `tsconfig.json` used to read, unless `--output` is passed.',
  });

  output = Option.String('--output,-o', {
    description: 'Specify where to output the persisted manifest file to.\tDefault: STDOUT',
  });

  async execute() {
    const tty = initTTY();
    if (!this.output && !tty.pipeTo) {
      console.error(
        "The --output option wasn't passed, but you also are not piping the current output to a file."
      );
      return 1;
    }
    // TODO: Add verbose/log/list/debug/trace option that outputs discovered documents (by name) per file
    await run(tty, { output: this.output, tsconfig: this.tsconfig });
    return 0;
  }
}
