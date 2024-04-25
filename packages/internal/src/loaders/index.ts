export type * from './types';

import path from 'node:path';
import type { SchemaLoader, SchemaOrigin } from './types';
import { loadFromSDL } from './sdl';
import { loadFromURL } from './url';

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

export interface LoadConfig {
  name?: string;
  origin: SchemaOrigin;
  rootPath?: string;
  fetchInterval?: number;
  assumeValid?: boolean;
}

export function load(config: LoadConfig): SchemaLoader {
  const urlOrigin = getURLConfig(config.origin);
  if (urlOrigin) {
    return loadFromURL({ ...urlOrigin, interval: config.fetchInterval, name: config.name });
  } else if (typeof config.origin === 'string') {
    const file = config.rootPath ? path.resolve(config.rootPath, config.origin) : config.origin;
    const assumeValid = config.assumeValid != null ? config.assumeValid : true;
    return loadFromSDL({ file, assumeValid, name: config.name });
  } else {
    throw new Error(`Configuration contains an invalid "schema" option`);
  }
}
