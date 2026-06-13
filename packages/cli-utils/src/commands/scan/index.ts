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
    description:
      'Which artifact to emit: `json` (metadata + insights) or `schema` (annotated SDL).\tDefault: a terminal report',
  });

  output = Option.String('--output,-o', {
    description: 'Specifies where to write `--format` output to.\tDefault: the piped output',
  });

  annotation = Option.String('--annotation', 'comment', {
    description:
      'How `--format schema` embeds field metadata: `comment` or `description`.\tDefault: comment',
  });

  measureTypes = Option.Boolean('--measure-types', false, {
    description: 'Evaluate inferred document types to record their size (slower).',
  });

  failOnWarn = Option.Boolean('--fail-on-warn,-w', false, {
    description: 'Triggers an error and a non-zero exit code if any warnings have been reported',
  });

  field = Option.String('--field', {
    description: 'Show where a schema coordinate (`Type.field`) is used, then exit.',
  });

  module = Option.String('--module', {
    description: 'Show the schema surface a module depends on, then exit.',
  });

  async execute() {
    const tty = initTTY();
    const result = await tty.start(
      run(tty, {
        tsconfig: this.tsconfig,
        format: this.format as ScanFormat | undefined,
        output: this.output,
        annotation: this.annotation === 'description' ? 'description' : 'comment',
        measureTypes: this.measureTypes,
        failOnWarn: this.failOnWarn,
        field: this.field,
        module: this.module,
      })
    );
    return exitCode() || (typeof result === 'object' ? result.exit : 0);
  }
}

/** Scans a project for all GraphQL documents and fragments, keys them to the
 * schema, and emits metadata, insights, an annotated schema, or a report.
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
