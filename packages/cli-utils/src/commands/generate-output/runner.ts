import * as path from 'node:path';

import {
  loadRef,
  minifyIntrospection,
  outputIntrospectionFile,
  extractIntrospectionHeader,
} from '@gql.tada/internal';

import type { TTY, ComposeInput } from '../../term';
import type { ProjectContext, WriteTarget } from '../shared';
import { loadProjects, writeOutput, readOutput } from '../shared';
import * as logger from './logger';

export interface OutputOptions {
  /** Whether to output the `.ts` format when the CLI's standard output is piped to an output file.
   * @defaultValue `false` */
  forceTSFormat?: boolean;
  /** Whether to disable the optimized output format for `.d.ts` files.
   * @defaultValue `false` */
  disablePreprocessing?: boolean;
  /** The filename to write the cache file to.
   * @defaultValue The `tadaTurboLocation` configuration option */
  output: string | undefined;
  /** The `tsconfig.json` to use for configurations and the TypeScript program.
   * @defaultValue A `tsconfig.json` in the current or any parent directory. */
  tsconfig: string | undefined;
  /** Whether to disable terminal output when using the programmatic API.
   * @defaultValue `false` */
  silent?: boolean;
}

export async function* run(tty: TTY, opts: OutputOptions): AsyncIterable<ComposeInput> {
  let projects: ProjectContext[];
  try {
    projects = await loadProjects(opts.tsconfig);
  } catch (error) {
    throw logger.externalError('Failed to load configuration.', error);
  }

  if (projects.length > 1 && (opts.output || tty.pipeTo)) {
    throw logger.errorMessage(
      'Output path was specified, while multiple projects are configured.\n' +
        logger.hint(
          `You can only output all projects to their ${logger.code(
            '"tadaOutputLocation"'
          )} options\n` +
            `when multiple projects are set up through ${logger.code('"references"')}.`
        )
    );
  }

  for (const project of projects) {
    if (projects.length > 1) yield logger.projectHeader(project.label);
    yield* runProject(tty, opts, project);
  }
}

/** Generates the introspection output for a single project. */
async function* runProject(
  tty: TTY,
  opts: OutputOptions,
  project: ProjectContext
): AsyncIterable<ComposeInput> {
  const { pluginConfig, projectPath } = project;

  let schemaRef = loadRef(pluginConfig);
  try {
    schemaRef = await schemaRef.load({ rootPath: projectPath });
  } catch (error) {
    throw logger.externalError('Failed to load schema(s).', error);
  }

  if ('schema' in pluginConfig) {
    const schema = schemaRef.current!;

    let destination: WriteTarget;
    if (!opts.output && tty.pipeTo) {
      destination = tty.pipeTo;
    } else if (opts.output) {
      destination = path.resolve(process.cwd(), opts.output);
    } else if (pluginConfig.tadaOutputLocation) {
      destination = path.resolve(projectPath, pluginConfig.tadaOutputLocation);
    } else {
      throw logger.errorMessage(
        'No output path was specified to write the output file to.\n' +
          logger.hint(
            `You have to either set ${logger.code(
              '"tadaOutputLocation"'
            )} in your configuration,\n` +
              `pass an ${logger.code('--output')} argument to this command,\n` +
              'or pipe this command to an output file.'
          )
      );
    }

    const existing = await readOutput(destination);
    let contents: string;
    try {
      contents = outputIntrospectionFile(minifyIntrospection(schema.introspection), {
        fileType:
          destination && typeof destination === 'string'
            ? destination
            : opts.forceTSFormat
              ? '.ts'
              : '.d.ts',
        shouldPreprocess: !opts.disablePreprocessing,
        preamble: existing ? extractIntrospectionHeader(existing) || undefined : undefined,
      });
    } catch (error) {
      throw logger.externalError('Could not generate introspection output', error);
    }

    try {
      await writeOutput(destination, contents);
    } catch (error) {
      throw logger.externalError(
        'Something went wrong while writing the introspection file',
        error
      );
    }

    yield logger.summary(!opts.forceTSFormat && typeof destination !== 'string');
  } else {
    if (opts.output) {
      throw logger.errorMessage(
        'Output path was specified, while multiple schemas are configured.\n' +
          logger.hint(
            `You can only output all schemas to their ${logger.code(
              '"tadaOutputLocation"'
            )} options\n` + `when multiple ${logger.code('schemas')} are set up.`
          )
      );
    }

    for (const schemaName in schemaRef.multi) {
      const schema = schemaRef.multi[schemaName];
      if (!schema) {
        continue;
      } else if (!schema.tadaOutputLocation) {
        throw logger.errorMessage(
          `No output path was specified to write the '${schemaName}' schema to.\n` +
            logger.hint(
              `You have to set ${logger.code('"tadaOutputLocation"')} in each schema configuration.`
            )
        );
      }

      const destination = path.resolve(projectPath, schema.tadaOutputLocation);
      const existing = await readOutput(destination);
      let contents: string;
      try {
        contents = outputIntrospectionFile(minifyIntrospection(schema.introspection), {
          fileType: schema.tadaOutputLocation,
          shouldPreprocess: !opts.disablePreprocessing,
          preamble: existing ? extractIntrospectionHeader(existing) || undefined : undefined,
        });
      } catch (error) {
        throw logger.externalError(
          `Could not generate any output for the '${schemaName}' schema`,
          error
        );
      }

      try {
        await writeOutput(destination, contents);
      } catch (error) {
        throw logger.externalError(
          `Something went wrong while writing the '${schemaName}' schema's output`,
          error
        );
      }
    }

    yield logger.summary();
  }
}
