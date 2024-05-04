export type * from './types';

import { loadFromSDL } from './sdl';
import { loadFromURL } from './url';

import type {
  SchemaLoaderResult,
  SchemaLoader,
  SchemaOrigin,
  SchemaRef,
  SingleSchemaInput,
  MultiSchemaInput,
  BaseLoadConfig,
} from './types';

export { loadFromSDL, loadFromURL };

export const getURLConfig = (origin: SchemaOrigin | null) => {
  try {
    return origin && !Array.isArray(origin)
      ? {
          url: new URL(typeof origin === 'object' ? origin.url : origin),
          headers: typeof origin === 'object' ? origin.headers : undefined,
        }
      : null;
  } catch (_error) {
    return null;
  }
};

export interface LoadConfig extends BaseLoadConfig {
  name?: string;
  origin: SchemaOrigin;
}

export function load(config: LoadConfig): SchemaLoader {
  const urlOrigin = getURLConfig(config.origin);
  if (urlOrigin) {
    return loadFromURL({
      ...urlOrigin,
      interval: config.fetchInterval,
      name: config.name,
    });
  } else if (typeof config.origin === 'string' || Array.isArray(config.origin)) {
    return loadFromSDL({
      assumeValid: config.assumeValid != null ? config.assumeValid : true,
      name: config.name,
      rootPath: config.rootPath,
      include: config.origin,
    });
  } else {
    throw new Error(`Configuration contains an invalid "schema" option`);
  }
}

export function loadRef(
  input: SingleSchemaInput | MultiSchemaInput | (SingleSchemaInput & MultiSchemaInput)
): SchemaRef {
  const teardowns: (() => void)[] = [];

  let _loaders: { input: SingleSchemaInput; loader: SchemaLoader }[] | undefined;
  const getLoaders = (config: BaseLoadConfig) => {
    if (!_loaders) {
      _loaders = (('schemas' in input && input.schemas) || []).map((input) => ({
        input,
        loader: load({ ...config, origin: input.schema, name: input.name }),
      }));
      if ('schema' in input && input.schema) {
        _loaders.push({
          input: { ...input, name: undefined },
          loader: load({ ...config, origin: input.schema }),
        });
      }
    }
    return _loaders;
  };

  const ref: SchemaRef = {
    version: 0,
    current: null,

    multi: (('schemas' in input && input.schemas) || []).reduce((acc, { name }) => {
      if (name) acc[name] = null;
      return acc;
    }, {}),

    autoupdate(config: BaseLoadConfig, onUpdate) {
      const loaders = getLoaders(config);
      teardowns.push(
        ...loaders.map(({ input, loader }) => {
          loader
            .load()
            .then((result) => {
              ref.version++;
              if (input.name) {
                ref.multi[input.name] = { ...input, ...result };
              } else {
                ref.current = { ...input, ...result };
              }
            })
            .catch((_error) => {
              /*noop*/
            });
          return loader.notifyOnUpdate((result) => {
            ref.version++;
            if (input.name) {
              ref.multi[input.name] = { ...input, ...result };
            } else {
              ref.current = { ...input, ...result };
            }
            onUpdate(ref, input);
          });
        })
      );
      return () => {
        let teardown: (() => void) | undefined;
        while ((teardown = teardowns.pop()) != null) teardown();
      };
    },
    async load(config: BaseLoadConfig) {
      const loaders = getLoaders(config);
      await Promise.all(
        loaders.map(async ({ input, loader }) => {
          const result = await loader.load();
          ref.version++;
          if (input.name) {
            ref.multi[input.name] = { ...input, ...result };
          } else {
            ref.current = { ...input, ...result };
          }
        })
      );
      return ref as SchemaRef<SchemaLoaderResult>;
    },
  };

  return ref;
}
