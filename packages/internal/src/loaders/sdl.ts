import type { IntrospectionQuery, GraphQLSchema } from 'graphql';
import { buildSchema, buildClientSchema, executeSync } from 'graphql';
import { CombinedError } from '@urql/core';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { SupportedFeatures } from './query';
import { makeIntrospectionQuery } from './query';

import type { SchemaLoader } from './types';

interface LoadFromSDLConfig {
  assumeValid?: boolean;
  file: string;
}

const ALL_SUPPORTED_FEATURES: SupportedFeatures = {
  directiveIsRepeatable: true,
  specifiedByURL: true,
  inputValueDeprecation: true,
};

export function loadFromSDL(config: LoadFromSDLConfig): SchemaLoader {
  const subscriptions = new Set<() => void>();

  let controller: AbortController | null = null;
  let introspection: IntrospectionQuery | null = null;
  let schema: GraphQLSchema | null = null;

  const watch = async () => {
    controller = new AbortController();
    const watcher = fs.watch(config.file, {
      signal: controller.signal,
      persistent: false,
    });
    try {
      for await (const _event of watcher) {
        for (const subscriber of subscriptions) subscriber();
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') throw error;
    } finally {
      controller = null;
    }
  };

  const introspect = async () => {
    const ext = path.extname(config.file);
    const data = await fs.readFile(config.file, { encoding: 'utf8' });
    if (ext === '.json') {
      introspection = JSON.parse(data) || null;
      schema =
        introspection && buildClientSchema(introspection, { assumeValid: !!config.assumeValid });
      return introspection;
    } else {
      schema = buildSchema(data, { assumeValidSDL: !!config.assumeValid });
      const query = makeIntrospectionQuery(ALL_SUPPORTED_FEATURES);
      const result = executeSync({ schema, document: query });
      if (result.errors) {
        throw new CombinedError({ graphQLErrors: result.errors as any[] });
      } else if (result.data) {
        return (introspection = (result.data as any) || null);
      } else {
        return (introspection = null);
      }
    }
  };

  return {
    async loadIntrospection() {
      return introspect();
    },
    async loadSchema() {
      if (schema) {
        return schema;
      } else {
        await this.loadIntrospection();
        return schema;
      }
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
  };
}
