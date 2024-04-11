import sade from 'sade';
import path from 'node:path';

import { executeTadaDoctor } from './commands/doctor';
import { check } from './commands/check';
import { initGqlTada } from './commands/init';
import { generatePersisted } from './commands/generate-persisted';
import { generateGraphQLCache } from './commands/cache';
import { generateSchema } from './commands/generate-schema';
import { generateTadaTypes } from './commands/generate-output';

const prog = sade('gql.tada');

prog.version(process.env.npm_package_version || '0.0.0');

async function main() {
  prog
    .command('init <folder>')
    .describe('Bootstraps your project with gql.tada.')
    .action(async (folder) => {
      const target = path.resolve(process.cwd(), folder);
      await initGqlTada(target);
    })
    .command('turbo')
    .describe('Caches all your existing types resulting from invocations of graphql().')
    .action(async () => {
      await generateGraphQLCache();
    })
    .command('doctor')
    .describe('Finds common issues in your gql.tada setup.')
    .action(async () => {
      return executeTadaDoctor();
    })
    .command('generate-schema <target>')
    .describe(
      'Generate a GraphQL schema from a URL or introspection file, this will be generated from the parameters to this command.'
    )
    .option('--header', 'Pass a header to be used when fetching the introspection.')
    .option(
      '--output',
      'A specialised location to output the schema to, by default we\'ll output the schema to the "schema" defined in your "tsconfig".'
    )
    .example("generate-schema https://example.com --header 'Authorization: Bearer token'")
    .example('generate-schema ./introspection.json')
    .action(async (target, options) => {
      const parsedHeaders = {};

      if (typeof options.header === 'string') {
        const [key, value] = options.header.split(':').map((part) => part.trim());
        parsedHeaders[key] = value;
      } else if (Array.isArray(options.header)) {
        options.header.forEach((header) => {
          const [key, value] = header.split(':').map((part) => part.trim());
          parsedHeaders[key] = value;
        });
      }

      return generateSchema(target, {
        headers: Object.keys(parsedHeaders).length ? parsedHeaders : undefined,
        output: options.output,
      });
    })
    .command('generate-persisted <target>')
    .describe(
      'This will run over your codebase looking for the graphql.persisted calls and come back with a persisted-operations JSON key-value mapping.'
    )
    .example('generate-example ./persisted-operations.json')
    .action(async (target) => {
      await generatePersisted(target);
    })
    .command('generate-output')
    .describe(
      'Generate the gql.tada types file, this will look for your "tsconfig.json" and use the "@0no-co/graphqlsp" configuration to generate the file.'
    )
    .option(
      '--disable-preprocessing',
      'Disables pre-processing, which is an internal introspection format generated ahead of time'
    )
    .action((options) => {
      const shouldPreprocess =
        !options['disable-preprocessing'] && options['disable-preprocessing'] !== 'false';
      return generateTadaTypes(shouldPreprocess);
    })
    .command('check')
    .describe(
      'Check runs the diagnostics that the LSP runs as a CLI process, this can be run alongside tsc to ensure your GraphQL documents are well structured.'
    )
    .option('--level', 'The minimum severity of diagnostics to display (error | warn | info).')
    .option('--exit-on-warn', 'Whether to exit with a non-zero code when there are warnings.')
    .action(async (opts) => {
      check({
        exitOnWarn: opts['exit-on-warn'] !== undefined ? opts['exit-on-warn'] : false,
        minSeverity: opts.level || 'error',
      });
    });
  prog.parse(process.argv);
}

export { generateTadaTypes, generateSchema };
export default main;
