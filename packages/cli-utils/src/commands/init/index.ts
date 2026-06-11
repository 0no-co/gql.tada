import * as path from 'node:path';
import { Command, Option } from 'clipanion';

export class InitCommand extends Command {
  static paths = [['init']];

  input = Option.String({ name: 'dir' });

  async execute() {
    const { run } = await import('./runner');
    const target = path.resolve(process.cwd(), this.input);
    await run(target);
  }
}
