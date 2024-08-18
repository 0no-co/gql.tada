import { Command } from 'clipanion';
import { exitCode } from '../../utils/error';
import { initTTY } from '../../term';
import { run } from './runner';

export class DoctorCommand extends Command {
  static paths = [['doctor']];

  async execute() {
    const result = await initTTY().start(run());
    return exitCode() || (typeof result === 'object' ? result.exit : 0);
  }
}
