export type * from './types';

import path from 'node:path';
import type { SchemaLoader, SchemaOrigin } from './types';
import { loadFromSDL } from './sdl';
import { loadFromURL } from './url';

export { loadFromSDL, loadFromURL };

const getURLConfig = (origin: SchemaOrigin | null) => {
  try {
    return (
      origin && {
        url: new URL(typeof origin === 'object' ? origin.url : origin),
        headers: typeof origin === 'object' ? origin.headers : undefined,
      }
    );
  } catch (_error) {
    throw new Error(`Configuration contains an invalid "schema" option`);
  }
};

export interface LoadConfig {
  origin: SchemaOrigin;
  rootPath?: string;
  fetchInterval?: number;
  assumeValid?: boolean;
}

export function load(config: LoadConfig): SchemaLoader {
  const urlOrigin = getURLConfig(origin);
  if (urlOrigin) {
    return loadFromURL({ ...urlOrigin, interval: config.fetchInterval });
  } else if (typeof origin === 'string') {
    const file = config.rootPath ? path.resolve(config.rootPath, origin) : origin;
    const assumeValid = config.assumeValid != null ? config.assumeValid : true;
    return loadFromSDL({ file, assumeValid });
  } else {
    throw new Error(`Configuration contains an invalid "schema" option`);
  }
}
