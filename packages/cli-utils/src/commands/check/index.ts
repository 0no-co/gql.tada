import * as t from 'typanion';
import { Command, Option } from 'clipanion';

export class CheckCommand extends Command {
  static paths = [['check']];

  failOnWarn = Option.Boolean('--fail-on-warn,-w', false, {
    description: 'Triggers an error and a non-zero exit code if any warnings have been reported',
  });

  level = Option.String('--level,-l', {
    description: 'The minimum severity of diagnostics to display (info, warn, error)',
    validator: t.isOneOf([t.isLiteral('info'), t.isLiteral('warn'), t.isLiteral('error')]),
  });

  async execute() {
    return 0;
  }
}
