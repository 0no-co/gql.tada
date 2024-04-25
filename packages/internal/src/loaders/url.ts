import type { IntrospectionQuery } from 'graphql';
import { buildClientSchema } from 'graphql';
import { Client, fetchExchange } from '@urql/core';
import { retryExchange } from '@urql/exchange-retry';

import { makeIntrospectionQuery, makeIntrospectSupportQuery, toSupportedFeatures } from './query';
import type { SupportedFeatures, IntrospectSupportQueryData } from './query';

import type { SchemaLoader, SchemaLoaderResult, OnSchemaUpdate } from './types';

interface LoadFromURLConfig {
  name?: string;
  url: URL | string;
  headers?: HeadersInit;
  interval?: number;
}

const ALL_SUPPORTED_FEATURES: SupportedFeatures = {
  directiveIsRepeatable: true,
  specifiedByURL: true,
  inputValueDeprecation: true,
  directiveArgumentsIsDeprecated: true,
  fieldArgumentsIsDeprecated: true,
};

const NO_SUPPORTED_FEATURES: SupportedFeatures = {
  directiveIsRepeatable: false,
  specifiedByURL: false,
  inputValueDeprecation: false,
  directiveArgumentsIsDeprecated: false,
  fieldArgumentsIsDeprecated: false,
};

export function loadFromURL(config: LoadFromURLConfig): SchemaLoader {
  const interval = config.interval || 60_000;
  const subscriptions = new Set<OnSchemaUpdate>();

  let timeoutID: NodeJS.Timeout | null = null;
  let supportedFeatures: SupportedFeatures | null = null;
  let result: SchemaLoaderResult | null = null;

  const client = new Client({
    url: `${config.url}`,
    fetchOptions: { headers: config.headers },
    exchanges: [
      retryExchange({
        initialDelayMs: 200,
        maxDelayMs: 1_500,
        maxNumberAttempts: 3,
        retryWith(error, operation) {
          if (error.networkError) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
          return operation;
        },
      }),
      fetchExchange,
    ],
  });

  const scheduleUpdate = () => {
    if (subscriptions.size && !timeoutID) {
      timeoutID = setTimeout(async () => {
        timeoutID = null;
        try {
          result = await load();
        } catch (_error) {
          result = null;
        }
        if (result) for (const subscriber of subscriptions) subscriber(result);
      }, interval);
    }
  };

  const introspect = async (support: SupportedFeatures): Promise<SchemaLoaderResult> => {
    const query = makeIntrospectionQuery(support);
    const introspectionResult = await client.query<IntrospectionQuery>(query, {});
    try {
      if (introspectionResult.error) {
        throw introspectionResult.error;
      } else if (introspectionResult.data) {
        const introspection = introspectionResult.data;
        return {
          introspection: {
            ...introspection,
            name: config.name,
          },
          schema: buildClientSchema(introspection, { assumeValid: true }),
        };
      } else {
        throw new Error(
          'Executing introspection against API failed.\n' +
            'The API failed to return any schema data or error.'
        );
      }
    } finally {
      scheduleUpdate();
    }
  };

  const load = async (): Promise<SchemaLoaderResult> => {
    if (!supportedFeatures) {
      const query = makeIntrospectSupportQuery();
      const supportResult = await client.query<IntrospectSupportQueryData>(query, {});
      if (supportResult.error && supportResult.error.graphQLErrors.length > 0) {
        // If we failed to determine support, we try to activate all introspection features
        const _result = await introspect(ALL_SUPPORTED_FEATURES);
        if (_result) {
          // If we succeed, we can return the introspection and enable all introspection features
          supportedFeatures = ALL_SUPPORTED_FEATURES;
          return _result;
        } else {
          // Otherwise, we assume no extra introspection features are supported,
          // since all introspection spec additions were made in a single spec revision
          supportedFeatures = NO_SUPPORTED_FEATURES;
        }
      } else if (supportResult.data && !supportResult.error) {
        // Succeeding the support query, we get the supported features
        supportedFeatures = toSupportedFeatures(supportResult.data);
      } else if (supportResult.error) {
        // On misc. error, we rethrow and reset supported features
        supportedFeatures = null;
        throw supportResult.error;
      } else {
        // Otherwise we assume no features are supported
        supportedFeatures = NO_SUPPORTED_FEATURES;
      }
    }
    return introspect(supportedFeatures);
  };

  return {
    get name() {
      return config.name;
    },
    async load(reload?: boolean) {
      return reload || !result ? (result = await load()) : result;
    },
    notifyOnUpdate(onUpdate) {
      subscriptions.add(onUpdate);
      return () => {
        subscriptions.delete(onUpdate);
        if (!subscriptions.size && timeoutID) {
          clearTimeout(timeoutID);
          timeoutID = null;
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
