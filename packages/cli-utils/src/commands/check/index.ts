import * as t from 'typanion';
import { Command, Option, UsageError } from 'clipanion';

import { exitCode } from '../../utils/error';
import { initTTY } from '../../term';
import { MACHINE_SCHEMA_VERSION, toMachineError, writeMachineOutput } from '../shared/machine';
import { createCheckResult, run } from './runner';

export class CheckCommand extends Command {
  static paths = [['check']];

  tsconfig = Option.String('--tsconfig,-c', {
    description: 'Specify the `tsconfig.json` used to read',
  });

  failOnWarn = Option.Boolean('--fail-on-warn,-w', false, {
    description: 'Triggers an error and a non-zero exit code if any warnings have been reported',
  });

  minSeverity =
    Option.String('--level,-l', {
      description: 'The minimum severity of diagnostics to display (info, warn, error)',
      validator: t.isOneOf([t.isLiteral('info'), t.isLiteral('warn'), t.isLiteral('error')]),
    }) || 'info';

  format = Option.String('--format,-f', {
    description: 'Emit the machine-readable `json` report',
    validator: t.isOneOf([t.isLiteral('json')]),
  });

  output = Option.String('--output,-o', {
    description: 'Write the JSON report to a file instead of standard output',
  });

  async execute() {
    if (this.output && this.format !== 'json') {
      throw new UsageError('The --output option requires --format json.');
    }

    if (this.format === 'json') {
      const tty = initTTY({ disableTTY: true, silent: true });
      const result = createCheckResult();
      const cwd = process.cwd();
      let caught: unknown;
      process.exitCode = 0;
      try {
        for await (const _output of run(tty, {
          failOnWarn: this.failOnWarn,
          minSeverity: this.minSeverity,
          tsconfig: this.tsconfig,
          machine: true,
          cwd,
          result,
        })) {
          // Machine mode records structured results and suppresses human output.
        }
      } catch (error) {
        caught = error;
      }
      const error = caught == null ? undefined : toMachineError(caught);
      const success = !error;
      const report = {
        schemaVersion: MACHINE_SCHEMA_VERSION,
        command: 'check' as const,
        success,
        ...result,
        ...(error ? { error } : {}),
      };

      try {
        await writeMachineOutput(tty, this.output, report);
      } catch (writeError) {
        const writeFailure = toMachineError(writeError);
        const fallbackReport = {
          ...report,
          success: false,
          error: error
            ? {
                ...error,
                message: `${error.message}\nFailed to write JSON report to ${this.output || 'stdout'}: ${writeFailure.message}`,
              }
            : {
                ...writeFailure,
                message: `Failed to write JSON report to ${this.output || 'stdout'}: ${writeFailure.message}`,
              },
        };
        try {
          await writeMachineOutput(tty, undefined, fallbackReport);
        } catch {
          // If fallback output fails, preserve exit status and move on.
        }
        const exit = writeFailure.exitCode;
        process.exitCode = exit;
        return exit;
      }

      const exit = error?.exitCode ?? 0;
      process.exitCode = exit;
      return exit;
    }

    const tty = initTTY();
    const result = await tty.start(
      run(tty, {
        failOnWarn: this.failOnWarn,
        minSeverity: this.minSeverity,
        tsconfig: this.tsconfig,
      })
    );
    return exitCode() || (typeof result === 'object' ? result.exit : 0);
  }
}
