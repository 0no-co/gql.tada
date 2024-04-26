import * as path from 'node:path';
import { TadaError } from './errors';
import { getURLConfig } from './loaders';
import type { SchemaOrigin } from './loaders';

export interface BaseConfig {
  template?: string;
}

export interface SchemaConfig {
  name?: string;
  schema: SchemaOrigin;
  tadaOutputLocation?: string;
  tadaTurboLocation?: string;
  tadaPersistedLocation?: string;
}

const SCHEMA_PROPS = [
  'name',
  'tadaOutputLocation',
  'tadaTurboLocation',
  'tadaPersistedLocation',
] as const;

interface MultiSchemaConfig extends SchemaConfig {
  name: string;
}

export type GraphQLSPConfig = BaseConfig & (SchemaConfig | { schemas: MultiSchemaConfig[] });

const parseSchemaConfig = (input: unknown, rootPath: string): SchemaConfig => {
  const resolveConfigDir = (input: string | undefined) => {
    if (!input) return input;
    return path.normalize(
      input.replace(/\${([^}]+)}/, (_match, name) => {
        if (name === 'configDir') {
          return rootPath;
        } else {
          throw new TadaError(
            `Substitution "\${${name}}" is not recognized (did you mean 'configDir'?)`
          );
        }
      })
    );
  };

  if (input == null || typeof input !== 'object') {
    throw new TadaError(`Schema is not configured properly (Received: ${input})`);
  }

  if ('schema' in input && input.schema && typeof input.schema === 'object') {
    const { schema } = input;
    if (!('url' in schema)) {
      throw new TadaError('Schema contains a `schema` object, but no `url` property');
    }

    if ('headers' in schema && schema.headers && typeof schema.headers === 'object') {
      for (const key in schema.headers) {
        if (schema.headers[key] && typeof schema.headers[key] !== 'string') {
          throw new TadaError(
            'Headers at `schema.headers` contain a non-string value at key: ' + key
          );
        }
      }
    } else if ('headers' in schema) {
      throw new TadaError("Schema contains a `schema.headers` property, but it's not an object");
    }
  }

  if (!('schema' in input) || typeof input.schema !== 'string') {
    throw new TadaError('Schema is missing a `schema` property');
  } else if (
    'tadaOutputLocation' in input &&
    input.tadaOutputLocation &&
    typeof input.tadaOutputLocation !== 'string'
  ) {
    throw new TadaError(
      "Schema contains a `tadaOutputLocation` property, but it's not a file path"
    );
  } else if (
    'tadaTurboLocation' in input &&
    input.tadaTurboLocation &&
    typeof input.tadaTurboLocation !== 'string'
  ) {
    throw new TadaError("Schema contains a `tadaTurboLocation` property, but it's not a file path");
  } else if (
    'tadaPersistedLocation' in input &&
    input.tadaPersistedLocation &&
    typeof input.tadaPersistedLocation !== 'string'
  ) {
    throw new TadaError(
      "Schema contains a `tadaPersistedLocation` property, but it's not a file path"
    );
  }

  const output = input as any as SchemaConfig;

  let schema: SchemaOrigin = output.schema;
  if (typeof schema === 'string') {
    const url = getURLConfig(schema);
    if (!url) schema = resolveConfigDir(schema) || schema;
  }

  return {
    ...output,
    schema,
    tadaOutputLocation: resolveConfigDir(output.tadaOutputLocation),
    tadaTurboLocation: resolveConfigDir(output.tadaTurboLocation),
    tadaPersistedLocation: resolveConfigDir(output.tadaPersistedLocation),
  };
};

export const parseConfig = (
  input: unknown,
  /** Defines the path of the "main" `tsconfig.json` file.
   * @remarks
   * This should be the `rootPath` output from `loadConfig`,
   * which is the path of the user's `tsconfig.json` before
   * resolving `extends` options.
   */
  rootPath: string = process.cwd()
): GraphQLSPConfig => {
  if (input == null || typeof input !== 'object') {
    throw new TadaError(`Configuration is of an invalid type (Received: ${input})`);
  } else if ('template' in input && input.template && typeof input.template !== 'string') {
    throw new TadaError("Configuration contains a `template` property, but it's not a string");
  } else if ('name' in input && input.name && typeof input.name !== 'string') {
    throw new TadaError("Configuration contains a `name` property, but it's not a string");
  }

  if ('schemas' in input) {
    if (!Array.isArray(input.schemas)) {
      throw new TadaError("Configuration contains a `schema` property, but it's not an array");
    }

    if ('schema' in input) {
      throw new TadaError(
        'If configuration contains a `schemas` property, it cannot contain a `schema` configuration.'
      );
    } else if ('tadaOutputLocation' in input) {
      throw new TadaError(
        "If configuration contains a `schemas` property, it cannot contain a 'tadaOutputLocation` configuration."
      );
    } else if ('tadaTurboLocation' in input) {
      throw new TadaError(
        "If configuration contains a `schemas` property, it cannot contain a 'tadaTurboLocation` configuration."
      );
    } else if ('tadaPersistedLocation' in input) {
      throw new TadaError(
        "If configuration contains a `schemas` property, it cannot contain a 'tadaPersistedLocation` configuration."
      );
    }

    const schemas = input.schemas.map((schema): MultiSchemaConfig => {
      if (!('name' in schema) || !schema.name || typeof schema.name !== 'string')
        throw new TadaError('All `schemas` configurations must contain a `name` label.');
      if (
        !('tadaOutputLocation' in schema) ||
        !schema.tadaOutputLocation ||
        typeof schema.tadaOutputLocation !== 'string'
      )
        throw new TadaError(
          'All `schemas` configurations must contain a `tadaOutputLocation` path.'
        );
      return {
        ...parseSchemaConfig(schema, rootPath),
        name: schema.name,
      };
    });

    for (const prop of SCHEMA_PROPS) {
      const values = schemas.map((schema) => schema[prop]).filter(Boolean);
      const uniqueValues = new Set(values);
      if (values.length !== uniqueValues.size)
        throw new TadaError(`All '${prop}' values in \`schemas[]\` must be unique.`);
    }

    return { ...input, schemas };
  } else {
    return { ...input, ...parseSchemaConfig(input, rootPath) };
  }
};

export const getSchemaNamesFromConfig = (config: GraphQLSPConfig): Set<null | string> => {
  return new Set<null | string>([
    ...('schema' in config ? [null] : []),
    ...('schemas' in config ? config.schemas.map((input) => input.name) : []),
  ]);
};

export const getSchemaConfigForName = (
  config: GraphQLSPConfig,
  name: string | undefined
): SchemaConfig | null => {
  if (name && 'name' in config && config.name === name) {
    return config;
  } else if (!name && !('schemas' in config)) {
    return config;
  } else if (name && 'schemas' in config) {
    for (let index = 0; index < config.schemas.length; index++)
      if (config.schemas[index].name === name) return config.schemas[index];
    return null;
  } else {
    return null;
  }
};
