import sade from 'sade';
import { promises as fs, existsSync } from 'node:fs';
import path, { resolve } from 'node:path';
// We use comment-json to parse the tsconfig as the default ones
// have comment annotations in JSON.
import { parse } from 'comment-json';
import type { IntrospectionQuery } from 'graphql';
import { buildClientSchema, getIntrospectionQuery, printSchema } from 'graphql';
import type { TsConfigJson } from 'type-fest';

import type { GraphQLSPConfig } from './lsp';
import { hasGraphQLSP } from './lsp';
import { ensureTadaIntrospection } from './tada';

const prog = sade('gql.tada');

prog.version(process.env.npm_package_version || '0.0.0');

async function main() {
  prog
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
      const cwd = process.cwd();
      let url: URL | undefined;

      try {
        url = new URL(target);
      } catch (e) {}

      let introspection: IntrospectionQuery;
      if (url) {
        const headers = (Array.isArray(options.header) ? options.header : [options.header]).reduce(
          (acc, item) => {
            if (!item) return acc;

            const parts = item.split(':');
            return {
              ...acc,
              [parts[0]]: parts[1],
            };
          },
          {}
        );
        const response = await fetch(url!.toString(), {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: getIntrospectionQuery({
              descriptions: true,
              schemaDescription: false,
              inputValueDeprecation: false,
              directiveIsRepeatable: false,
              specifiedByUrl: false,
            }),
          }),
        });

        if (response.ok) {
          const text = await response.text();

          try {
            const result = JSON.parse(text);
            if (result.data) {
              introspection = (result as { data: IntrospectionQuery }).data;
            } else {
              console.error(`Got invalid response ${JSON.stringify(result)}`);
              return;
            }
          } catch (e) {
            console.error(`Got invalid JSON ${text}`);
            return;
          }
        } else {
          console.error(`Got invalid response ${await response.text()}`);
          return;
        }
      } else {
        const path = resolve(cwd, target);
        const fileContents = await fs.readFile(path, 'utf-8');

        try {
          introspection = JSON.parse(fileContents);
        } catch (e) {
          console.error(`Got invalid JSON ${fileContents}`);
          return;
        }
      }

      const schema = buildClientSchema(introspection!);

      let destination = options.output;
      if (!destination) {
        const cwd = process.cwd();
        const tsconfigpath = path.resolve(cwd, 'tsconfig.json');
        const hasTsConfig = existsSync(tsconfigpath);
        if (!hasTsConfig) {
          console.error(`Could not find a tsconfig in the working-directory.`);
          return;
        }

        const tsconfigContents = await fs.readFile(tsconfigpath, 'utf-8');
        let tsConfig: TsConfigJson;
        try {
          tsConfig = parse(tsconfigContents) as TsConfigJson;
        } catch (err) {
          console.error(err);
          return;
        }

        if (!hasGraphQLSP(tsConfig)) {
          console.error(`Could not find a "@0no-co/graphqlsp" plugin in your tsconfig.`);
          return;
        }

        const foundPlugin = tsConfig.compilerOptions!.plugins!.find(
          (plugin) => plugin.name === '@0no-co/graphqlsp'
        ) as GraphQLSPConfig;

        destination = foundPlugin.schema;

        if (!foundPlugin.schema.endsWith('.graphql')) {
          console.error(`Found "${foundPlugin.schema}" which is not a path to a GraphQL Schema.`);
          return;
        }
      }

      await fs.writeFile(resolve(cwd, destination), printSchema(schema), 'utf-8');
    })
    .command('generate-output')
    .describe(
      'Generate the gql.tada types file, this will look for your "tsconfig.json" and use the "@0no-co/graphqlsp" configuration to generate the file.'
    )
    .action(async () => {
      const cwd = process.cwd();
      const tsconfigpath = path.resolve(cwd, 'tsconfig.json');
      const hasTsConfig = existsSync(tsconfigpath);
      if (!hasTsConfig) {
        console.error('Missing tsconfig.json');
        return;
      }

      const tsconfigContents = await fs.readFile(tsconfigpath, 'utf-8');
      let tsConfig: TsConfigJson;
      try {
        tsConfig = parse(tsconfigContents) as TsConfigJson;
      } catch (err) {
        console.error(err);
        return;
      }

      if (!hasGraphQLSP(tsConfig)) {
        return;
      }

      const foundPlugin = tsConfig.compilerOptions!.plugins!.find(
        (plugin) => plugin.name === '@0no-co/graphqlsp'
      ) as GraphQLSPConfig;

      await ensureTadaIntrospection(foundPlugin.schema, foundPlugin.tadaOutputLocation!);
    });
  prog.parse(process.argv);
}

export default main;
