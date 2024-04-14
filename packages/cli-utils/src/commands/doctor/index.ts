import { Command } from 'clipanion';
import { initTTY } from '../../term';
import { run } from './runner';

export class DoctorCommand extends Command {
  static paths = [['doctor']];

  async execute() {
    const result = await initTTY().start(run());
    return process.exitCode || (typeof result === 'object' ? result.exit : 0);
  }
}
