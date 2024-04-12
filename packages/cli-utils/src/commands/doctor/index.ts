import { Command } from 'clipanion';

export class DoctorCommand extends Command {
  static paths = [['doctor']];

  async execute() {
    return 0;
  }
}
