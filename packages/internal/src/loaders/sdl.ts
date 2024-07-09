import ts from 'typescript';
import type { IntrospectionQuery } from 'graphql';
import { buildSchema, buildClientSchema, executeSync } from 'graphql';
import { CombinedError } from '@urql/core';
import fs from 'node:fs/promises';
import path from 'node:path';

import { makeIntrospectionQuery, getPeerSupportedFeatures } from './introspection';

import type { SchemaLoader, SchemaLoaderResult, OnSchemaUpdate } from './types';

interface LoadFromSDLConfig {
  name?: string;
  assumeValid?: boolean;
  file: string;
}

export function loadFromSDL(config: LoadFromSDLConfig): SchemaLoader {
  const subscriptions = new Set<OnSchemaUpdate>();

  let abort: (() => void) | null = null;
  let result: SchemaLoaderResult | null = null;

  const load = async (): Promise<SchemaLoaderResult> => {
    const ext = path.extname(config.file);
    const data = await fs.readFile(config.file, { encoding: 'utf8' });
    if (ext === '.json') {
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
    if (ts.sys.watchFile) {
      const watcher = ts.sys.watchFile(
        config.file,
        async () => {
          try {
            if ((result = await load())) {
              for (const subscriber of subscriptions) subscriber(result);
            }
          } catch (_error) {}
        },
        250,
        {
          // NOTE: Using `ts.WatchFileKind.UseFsEvents` causes missed events just like fs.watch
          // as below on macOS, as of TypeScript 5.5 and is hence avoided here
          watchFile: ts.WatchFileKind.UseFsEventsOnParentDirectory,
          fallbackPolling: ts.PollingWatchKind.PriorityInterval,
        }
      );
      abort = () => watcher.close();
    } else {
      const controller = new AbortController();
      abort = () => controller.abort();
      const watcher = fs.watch(config.file, {
        signal: controller.signal,
        persistent: false,
      });
      try {
        for await (const _event of watcher) {
          if ((result = await load())) {
            for (const subscriber of subscriptions) subscriber(result);
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') throw error;
      } finally {
        abort = null;
      }
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
        if (!subscriptions.size && abort) abort();
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
