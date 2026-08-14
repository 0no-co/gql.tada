import * as path from 'node:path';
import { Command, Option, UsageError } from 'clipanion';

export class InitCommand extends Command {
  static paths = [['init']];

  input = Option.String({ name: 'dir' });

  schema = Option.String('--schema,-s', {
    description: 'Configure non-interactively with a schema URL or local schema file',
  });

  output = Option.String('--output,-o', {
    description: 'Output typings path for non-interactive setup (default: src/graphql-env.d.ts)',
  });

  install = Option.Boolean('--install', {
    description:
      'Whether to install dependencies in non-interactive mode (use --no-install to only update package.json)',
  });

  async execute() {
    const target = path.resolve(process.cwd(), this.input);
    const nonInteractive = !!this.schema || !!this.output || this.install !== undefined;

    if (!nonInteractive) {
      const { InitCancelledError, run } = await import('./runner');
      try {
        await run(target);
        return 0;
      } catch (error) {
        if (error instanceof InitCancelledError) return 0;
        throw error;
      }
    }

    if (!this.schema) {
      throw new UsageError('Non-interactive init requires --schema.');
    }
    if (this.install === undefined) {
      throw new UsageError('Non-interactive init requires either --install or --no-install.');
    }

    const { configureProject } = await import('./runner');
    const result = await configureProject(target, {
      schema: this.schema,
      output: this.output || './src/graphql-env.d.ts',
      install: this.install,
    });
    this.context.stdout.write(
      `Configured gql.tada in ${path.relative(target, result.tsconfig) || 'tsconfig.json'}\n`
    );
    return 0;
  }
}
