import type { IntrospectionQuery } from 'graphql';
import { buildSchema, buildClientSchema, executeSync } from 'graphql';
import { CombinedError } from '@urql/core';
import ts from 'typescript';
import fs from 'node:fs/promises';
import path from 'node:path';

import { makeIntrospectionQuery, getPeerSupportedFeatures } from './introspection';

import type { SchemaLoader, SchemaLoaderResult, OnSchemaUpdate } from './types';

const EXTENSIONS = ['.graphql', '.gql', '.json'] as const;
const EXCLUDE = ['**/node_modules'] as const;

const readInclude = (rootPath: string, include: string[] | string) => {
  const files = ts.sys.readDirectory(
    rootPath,
    EXTENSIONS,
    EXCLUDE,
    typeof include === 'string' ? [include] : include
  );
  if (files.length === 0) {
    throw new Error(`No schema input was found at "${rootPath}".`);
  } else if (files.length > 1 && files.some((file) => path.extname(file) === '.json')) {
    throw new Error(
      'Multiple schema inputs were passed, but at least one is a JSON file.\n' +
        'A JSON introspection schema cannot be combined with other schemas.'
    );
  }
  return files;
};

interface LoadFromSDLConfig {
  rootPath: string;
  include: string | string[];
  name?: string;
  assumeValid?: boolean;
}

export function loadFromSDL(config: LoadFromSDLConfig): SchemaLoader {
  const subscriptions = new Set<OnSchemaUpdate>();

  let files: string[] | undefined;
  let controller: AbortController | null = null;
  let result: SchemaLoaderResult | null = null;

  const load = async (): Promise<SchemaLoaderResult> => {
    files = readInclude(config.rootPath, config.include);
    if (path.extname(files[0]) === '.json') {
      const data = await fs.readFile(files[0], { encoding: 'utf8' });
      const introspection = JSON.parse(data) as IntrospectionQuery | null;
      if (!introspection || !introspection.__schema) {
        throw new Error(
          'Parsing JSON introspection data failed.\n' +
            'The JSON payload did not evaluate to an introspection schema.'
        );
      }
      return {
        introspection: {
          ...introspection,
          name: config.name,
        },
        schema: buildClientSchema(introspection, { assumeValid: !!config.assumeValid }),
      };
    } else {
      const data = (await Promise.all(files.map((file) => fs.readFile(file, 'utf-8')))).join(
        '\n\n'
      );
      const schema = buildSchema(data, { assumeValidSDL: !!config.assumeValid });
      const query = makeIntrospectionQuery(getPeerSupportedFeatures());
      const queryResult = executeSync({ schema, document: query });
      if (queryResult.errors) {
        throw new CombinedError({ graphQLErrors: queryResult.errors as any[] });
      } else if (queryResult.data) {
        const introspection = {
          ...(queryResult.data as unknown as IntrospectionQuery),
          name: config.name,
        };
        return { introspection, schema };
      } else {
        throw new Error(
          'Executing introspection against SDL schema failed.\n' +
            '`graphql` failed to return any schema data or error.'
        );
      }
    }
  };

  const watch = async () => {
    if (!files) return;
    controller = new AbortController();
    for (const file of files) {
      const watcher = fs.watch(file, {
        signal: controller!.signal,
        persistent: false,
      });
      (async () => {
        try {
          for await (const _event of watcher) {
            if ((result = await load())) {
              for (const subscriber of subscriptions) subscriber(result);
            }
          }
        } catch (error: any) {
          if (error.name !== 'AbortError') throw error;
        } finally {
          controller = null;
        }
      })();
    }
  };

  return {
    get name() {
      return config.name;
    },
    async load(reload?: boolean) {
      return reload || !result ? (result = await load()) : result;
    },
    notifyOnUpdate(onUpdate) {
      if (!subscriptions.size) watch();
      subscriptions.add(onUpdate);
      return () => {
        subscriptions.delete(onUpdate);
        if (!subscriptions.size && controller) {
          controller.abort();
        }
      };
    },
    async loadIntrospection() {
      const result = await this.load();
      return result && result.introspection;
    },
    async loadSchema() {
      const result = await this.load();
      return result && result.schema;
    },
  };
}
