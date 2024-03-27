import type { IntrospectionQuery, GraphQLSchema } from 'graphql';
import { buildClientSchema } from 'graphql';
import { Client, fetchExchange } from '@urql/core';
import { retryExchange } from '@urql/exchange-retry';

import type { SupportedFeatures, IntrospectSupportQueryData } from './query';

import { makeIntrospectionQuery, makeIntrospectSupportQuery, toSupportedFeatures } from './query';

import type { SchemaLoader } from './types';

interface LoadFromURLConfig {
  url: URL | string;
  headers?: HeadersInit;
  interval?: number;
}

const ALL_SUPPORTED_FEATURES: SupportedFeatures = {
  directiveIsRepeatable: true,
  specifiedByURL: true,
  inputValueDeprecation: true,
};

const NO_SUPPORTED_FEATURES: SupportedFeatures = {
  directiveIsRepeatable: false,
  specifiedByURL: false,
  inputValueDeprecation: false,
};

export function loadFromURL(config: LoadFromURLConfig): SchemaLoader {
  const interval = config.interval || 60_000;
  const subscriptions = new Set<() => void>();

  let timeoutID: NodeJS.Timeout | null = null;
  let supportedFeatures: SupportedFeatures | null = null;
  let introspection: IntrospectionQuery | null = null;
  let schema: GraphQLSchema | null = null;

  const client = new Client({
    url: `${config.url}`,
    fetchOptions: { headers: config.headers },
    exchanges: [retryExchange({ initialDelayMs: 200, maxDelayMs: 1_500 }), fetchExchange],
  });

  const scheduleUpdate = () => {
    if (subscriptions.size && !timeoutID) {
      timeoutID = setTimeout(() => {
        for (const subscriber of subscriptions) subscriber();
        timeoutID = null;
      }, interval);
    }
  };

  const introspect = async (support: SupportedFeatures): Promise<IntrospectionQuery | null> => {
    const query = makeIntrospectionQuery(support);
    const result = await client.query<IntrospectionQuery>(query, {});

    try {
      if (result.error && result.error.graphQLErrors.length > 0) {
        schema = null;
        return (introspection = null);
      } else if (result.error) {
        schema = null;
        throw result.error;
      } else {
        schema = null;
        return (introspection = result.data || null);
      }
    } finally {
      scheduleUpdate();
    }
  };

  return {
    async loadIntrospection() {
      if (!supportedFeatures) {
        const query = makeIntrospectSupportQuery();
        const result = await client.query<IntrospectSupportQueryData>(query, {});
        if (result.error && result.error.graphQLErrors.length > 0) {
          // If we failed to determine support, we try to activate all introspection features
          introspection = await introspect(ALL_SUPPORTED_FEATURES);
          if (introspection) {
            // If we succeed, we can return the introspection and enable all introspection features
            supportedFeatures = ALL_SUPPORTED_FEATURES;
            return introspection;
          } else {
            // Otherwise, we assume no extra introspection features are supported,
            // since all introspection spec additions were made in a single spec revision
            supportedFeatures = NO_SUPPORTED_FEATURES;
          }
        } else if (result.data && !result.error) {
          // Succeeding the support query, we get the supported features
          supportedFeatures = toSupportedFeatures(result.data);
        } else if (result.error) {
          // On misc. error, we rethrow and reset supported features
          supportedFeatures = null;
          throw result.error;
        } else {
          // Otherwise we assume no features are supported
          supportedFeatures = NO_SUPPORTED_FEATURES;
        }
      }

      return introspect(supportedFeatures);
    },

    async loadSchema() {
      if (schema) {
        return schema;
      } else {
        const introspection = await this.loadIntrospection();
        schema = introspection && buildClientSchema(introspection, { assumeValid: true });
        return schema;
      }
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
  };
}
