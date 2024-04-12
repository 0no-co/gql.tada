import { Command } from 'clipanion';

export class TurboCommand extends Command {
  static paths = [['generate turbo'], ['turbo']];

  async execute() {
    return 0;
  }
}
