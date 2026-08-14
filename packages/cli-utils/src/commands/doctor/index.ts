import * as t from 'typanion';
import { Command, Option, UsageError } from 'clipanion';

import { exitCode } from '../../utils/error';
import { initTTY } from '../../term';
import { MACHINE_SCHEMA_VERSION, toMachineError, writeMachineOutput } from '../shared/machine';
import { createDoctorResult, DoctorReporter } from './report';
import { run } from './runner';

export class DoctorCommand extends Command {
  static paths = [['doctor']];

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
      const result = createDoctorResult();
      const reporter = new DoctorReporter(result);
      let caught: unknown;
      try {
        for await (const _output of run(reporter)) {
          // Machine mode records structured results and suppresses human output.
        }
      } catch (error) {
        caught = error;
      }
      const error = caught == null ? undefined : toMachineError(caught);
      if (error) {
        const active = result.checks.find((check) => check.status === 'pending');
        if (active) active.status = 'fail';
        result.issues.push({
          severity: 'error',
          check: active?.id ?? 'doctor',
          message: error.message,
        });
      }
      const report = {
        schemaVersion: MACHINE_SCHEMA_VERSION,
        command: 'doctor' as const,
        success: !error,
        ...result,
        ...(error ? { error } : {}),
      };
      await writeMachineOutput(tty, this.output, report);
      return error?.exitCode ?? 0;
    }

    const result = await initTTY().start(run());
    return exitCode() || (typeof result === 'object' ? result.exit : 0);
  }
}
