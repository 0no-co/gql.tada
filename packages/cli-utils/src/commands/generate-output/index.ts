import { Command, Option } from 'clipanion';

export class GenerateOutputCommand extends Command {
  static paths = [['generate-output'], ['generate', 'output']];

  disablePreprocessing = Option.Boolean('--disable-preprocessing', false, {
    description:
      'Disables pre-processing, which is an internal introspection format generated ahead of time',
  });

  output = Option.String('--output,-o', {
    description:
      'Specifies where to output the file to.\tDefault: The `tadaOutputLocation` configuration option',
  });

  async execute() {
    return 0;
  }
}
