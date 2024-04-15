import { TadaError } from './errors';
import type { SchemaOrigin } from './loaders/types';

export interface GraphQLSPConfig {
  schema: SchemaOrigin;
  tadaOutputLocation?: string;
  tadaTurboLocation?: string;
  tadaPersistedLocation?: string;
  template?: string;
}

export const parseConfig = (input: Record<string, unknown>) => {
  if (input.schema && typeof input.schema === 'object') {
    const { schema } = input;
    if (!('url' in schema)) {
      throw new TadaError('Configuration contains a `schema` object, but no `url` property');
    }

    if ('headers' in schema && schema.headers && typeof schema.headers !== 'object') {
      for (const key in schema.headers) {
        if (schema.headers[key] && typeof schema.headers[key] !== 'string') {
          throw new TadaError(
            'Headers at `schema.headers` contain a non-string value at key: ' + key
          );
        }
      }
    } else if ('headers' in schema) {
      throw new TadaError(
        "Configuration contains a `schema.headers` property, but it's not an object"
      );
    }
  } else if (typeof input.schema !== 'string') {
    throw new TadaError('Configuration is missing a `schema` property');
  } else if (
    'tadaOutputLocation' in input &&
    input.tadaOutputLocation &&
    typeof input.tadaOutputLocation !== 'string'
  ) {
    throw new TadaError(
      "Configuration contains a `tadaOutputLocation` property, but it's not a file path"
    );
  } else if (
    'tadaTurboLocation' in input &&
    input.tadaTurboLocation &&
    typeof input.tadaTurboLocation !== 'string'
  ) {
    throw new TadaError(
      "Configuration contains a `tadaTurboLocation` property, but it's not a file path"
    );
  } else if (
    'tadaPersistedLocation' in input &&
    input.tadaPersistedLocation &&
    typeof input.tadaPersistedLocation !== 'string'
  ) {
    throw new TadaError(
      "Configuration contains a `tadaPersistedLocation` property, but it's not a file path"
    );
  } else if ('template' in input && input.template && typeof input.template !== 'string') {
    throw new TadaError("Configuration contains a `template` property, but it's not a string");
  }

  return input as any as GraphQLSPConfig;
};
