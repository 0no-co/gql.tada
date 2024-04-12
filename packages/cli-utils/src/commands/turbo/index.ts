import { Command, Option } from 'clipanion';
import { run } from './runner';

export class TurboCommand extends Command {
  static paths = [['generate turbo'], ['turbo']];

  tsconfig = Option.String('--tsconfig,-c', {
    description: 'Specify the `tsconfig.json` read for configuration.',
  });

  async execute() {
    // TODO: Add verbose/log/list/debug/trace option that outputs discovered documents (by name) per file
    await run({ tsconfig: this.tsconfig });
  }
}
