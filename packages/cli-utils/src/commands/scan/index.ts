import { Command, Option } from 'clipanion';

import type { ScanOptions, ScanFormat } from './runner';
import { exitCode } from '../../utils/error';
import { initTTY } from '../../term';
import { run } from './runner';

export class ScanCommand extends Command {
  static paths = [['scan']];

  tsconfig = Option.String('--tsconfig,-c', {
    description: 'Specify the `tsconfig.json` read for configuration.',
  });

  format = Option.String('--format,-f', {
    description: 'Emit the machine-readable `json` report.\tDefault: a terminal report',
  });

  graph = Option.Boolean('--graph', false, {
    description: 'Emit only the relationship graph as JSON (implies machine output).',
  });

  output = Option.String('--output,-o', {
    description: 'Write machine output to this file.\tDefault: standard output',
  });

  failOnWarn = Option.Boolean('--fail-on-warn,-w', false, {
    description: 'Triggers an error and a non-zero exit code if any warnings have been reported',
  });

  async execute() {
    const tty = initTTY();
    const result = await tty.start(
      run(tty, {
        tsconfig: this.tsconfig,
        format: this.format as ScanFormat | undefined,
        graph: this.graph,
        output: this.output,
        failOnWarn: this.failOnWarn,
      })
    );
    return exitCode() || (typeof result === 'object' ? result.exit : 0);
  }
}

/** Scans a project for all GraphQL documents and fragments, keys them to the
 * schema, and emits a JSON report (when piped or given `--output`) or a
 * human-readable terminal report.
 *
 * @see {@link https://gql-tada.0no.co/reference/gql-tada-cli#scan}
 */
export async function scan(opts: ScanOptions) {
  const tty = initTTY({ disableTTY: true });
  const result = await tty.start(run(tty, opts));
  if (result instanceof Error) {
    throw result;
  }
}
