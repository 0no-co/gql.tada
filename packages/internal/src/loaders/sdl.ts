import type { IntrospectionQuery } from 'graphql';
import { buildSchema, buildClientSchema, executeSync } from 'graphql';
import { CombinedError } from '@urql/core';
import fs from 'node:fs/promises';
import path from 'node:path';

import { makeIntrospectionQuery } from './query';
import type { SupportedFeatures } from './query';

import type { SchemaLoader, SchemaLoaderResult, OnSchemaUpdate } from './types';

interface LoadFromSDLConfig {
  assumeValid?: boolean;
  file: string;
}

const ALL_SUPPORTED_FEATURES: SupportedFeatures = {
  directiveIsRepeatable: true,
  specifiedByURL: true,
  inputValueDeprecation: true,
  supportsDirectiveIsDeprecatedArgument: true,
  supportsFieldIsDeprecatedArgument: true,
};

export function loadFromSDL(config: LoadFromSDLConfig): SchemaLoader {
  const subscriptions = new Set<OnSchemaUpdate>();

  let controller: AbortController | null = null;
  let result: SchemaLoaderResult | null = null;

  const load = async (): Promise<typeof result> => {
    const ext = path.extname(config.file);
    const data = await fs.readFile(config.file, { encoding: 'utf8' });
    if (ext === '.json') {
      let introspection: IntrospectionQuery | null = null;
      try {
        introspection = JSON.parse(data);
      } catch (_error) {}
      return (
        introspection && {
          introspection,
          schema: buildClientSchema(introspection, { assumeValid: !!config.assumeValid }),
        }
      );
    } else {
      const schema = buildSchema(data, { assumeValidSDL: !!config.assumeValid });
      const query = makeIntrospectionQuery(ALL_SUPPORTED_FEATURES);
      const queryResult = executeSync({ schema, document: query });
      if (queryResult.errors) {
        throw new CombinedError({ graphQLErrors: queryResult.errors as any[] });
      } else if (queryResult.data) {
        const introspection = queryResult.data as unknown as IntrospectionQuery;
        return { introspection, schema };
      } else {
        return null;
      }
    }
  };

  const watch = async () => {
    controller = new AbortController();
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
      controller = null;
    }
  };

  return {
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
