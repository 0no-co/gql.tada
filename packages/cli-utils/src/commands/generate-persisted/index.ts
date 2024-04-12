import { Command, Option } from 'clipanion';

export class GeneratePersisted extends Command {
  static paths = [['generate-persisted'], ['generate', 'persisted']];

  output = Option.String('--output,-o', {
    description: 'Specifies where to output the persisted manifest file to.\tDefault: STDOUT',
  });

  async execute() {
    return 0;
  }
}
