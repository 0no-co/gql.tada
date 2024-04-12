import { Command } from 'clipanion';

export class InitCommand extends Command {
  static paths = [['init']];

  async execute() {
    return 0;
  }
}
