import * as t from 'typanion';
import { Command, Option } from 'clipanion';

import { exitCode } from '../../utils/error';
import { initTTY } from '../../term';
import { run } from './runner';

export class CheckCommand extends Command {
  static paths = [['check']];

  tsconfig = Option.String('--tsconfig,-c', {
    description: 'Specify the `tsconfig.json` used to read',
  });

  failOnWarn = Option.Boolean('--fail-on-warn,-w', false, {
    description: 'Triggers an error and a non-zero exit code if any warnings have been reported',
  });

  compiler = Option.String('--compiler', {
    description:
      'The compiler to check with (typescript, tsrs). Defaults to the installed TypeScript, or tsrs if only tsrs is installed',
    validator: t.isOneOf([t.isLiteral('typescript'), t.isLiteral('tsrs')]),
  });

  minSeverity =
    Option.String('--level,-l', {
      description: 'The minimum severity of diagnostics to display (info, warn, error)',
      validator: t.isOneOf([t.isLiteral('info'), t.isLiteral('warn'), t.isLiteral('error')]),
    }) || 'info';

  async execute() {
    const tty = initTTY();
    const result = await tty.start(
      run(tty, {
        failOnWarn: this.failOnWarn,
        minSeverity: this.minSeverity,
        tsconfig: this.tsconfig,
        compiler: this.compiler,
      })
    );
    return exitCode() || (typeof result === 'object' ? result.exit : 0);
  }
}
