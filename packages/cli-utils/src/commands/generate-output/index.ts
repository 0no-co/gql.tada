import { Command, Option } from 'clipanion';

import { initTTY } from '../../term';
import { run } from './runner';

export class GenerateOutputCommand extends Command {
  static paths = [['generate-output'], ['generate', 'output']];

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
    await run(initTTY(), {
      disablePreprocessing: this.disablePreprocessing,
      output: this.output,
      tsconfig: this.tsconfig,
    });
  }
}
