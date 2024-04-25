export type * from './types';

import path from 'node:path';
import { loadFromSDL } from './sdl';
import { loadFromURL } from './url';

import type { SchemaLoaderResult, SchemaLoader, SchemaOrigin, SchemaRef } from './types';

export { loadFromSDL, loadFromURL };

export const getURLConfig = (origin: SchemaOrigin | null) => {
  try {
    return origin
      ? {
          url: new URL(typeof origin === 'object' ? origin.url : origin),
          headers: typeof origin === 'object' ? origin.headers : undefined,
        }
      : null;
  } catch (_error) {
    return null;
  }
};

export interface BaseLoadConfig {
  rootPath?: string;
  fetchInterval?: number;
  assumeValid?: boolean;
}

export interface LoadConfig extends BaseLoadConfig {
  origin: SchemaOrigin;
}

export function load(config: LoadConfig): SchemaLoader {
  const urlOrigin = getURLConfig(config.origin);
  if (urlOrigin) {
    return loadFromURL({ ...urlOrigin, interval: config.fetchInterval });
  } else if (typeof config.origin === 'string') {
    const file = config.rootPath ? path.resolve(config.rootPath, config.origin) : config.origin;
    const assumeValid = config.assumeValid != null ? config.assumeValid : true;
    return loadFromSDL({ file, assumeValid });
  } else {
    throw new Error(`Configuration contains an invalid "schema" option`);
  }
}

type SingleSchema = { name?: string; schema: SchemaOrigin };
type MultiSchema = { schemas?: SingleSchema[] };

export function loadRef(
  input: SingleSchema | MultiSchema | (SingleSchema & MultiSchema),
  config?: BaseLoadConfig
): SchemaRef {
  const teardowns: (() => void)[] = [];

  const loaders = (('schemas' in input && input.schemas) || []).map((item) => ({
    name: item.name,
    loader: load({ ...config, origin: item.schema }),
  }));
  if ('schema' in input && input.schema) {
    loaders.push({
      name: input.name,
      loader: load({ ...config, origin: input.schema }),
    });
  }

  const ref: SchemaRef = {
    version: 0,
    current: null,
    multi: loaders.reduce((acc, { name }) => {
      if (name) acc[name] = null;
      return acc;
    }, {}),

    autoupdate() {
      teardowns.push(
        ...loaders.map(({ name, loader }) => {
          loader.load().then((result) => {
            ref.version++;
            if (name) {
              ref.multi[name] = result;
            } else {
              ref.current = result;
            }
          });
          return loader.notifyOnUpdate((result) => {
            ref.version++;
            if (name) {
              ref.multi[name] = result;
            } else {
              ref.current = result;
            }
          });
        })
      );
      return () => {
        let teardown: (() => void) | undefined;
        while ((teardown = teardowns.pop()) != null) teardown();
      };
    },
    async load() {
      await Promise.all(
        loaders.map(async ({ name, loader }) => {
          ref.version++;
          if (name) {
            ref.multi[name] = await loader.load();
          } else {
            ref.current = await loader.load();
          }
        })
      );
      return ref as SchemaRef<SchemaLoaderResult>;
    },
  };

  return ref;
}
