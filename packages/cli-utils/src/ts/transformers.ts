import type ts from 'typescript';
import * as path from 'node:path';

import { TadaError } from '../utils/error';

let _svelte: typeof import('@gql.tada/svelte-support');
let _vue: typeof import('@gql.tada/vue-support');

const transformSvelte = async (
  ...args: Parameters<typeof _svelte.transform>
): Promise<ReturnType<typeof _svelte.transform>> => {
  if (!_svelte) {
    try {
      _svelte = await import('@gql.tada/svelte-support');
    } catch (_error) {
      throw new TadaError(
        'For Svelte support the `@gql.tada/svelte-support` package must be installed.\n' +
          'Install the package and try again.'
      );
    }
  }
  return _svelte.transform(...args);
};

const transformVue = async (
  ...args: Parameters<typeof _vue.transform>
): Promise<ReturnType<typeof _vue.transform>> => {
  if (!_vue) {
    try {
      _vue = await import('@gql.tada/vue-support');
    } catch (_error) {
      throw new TadaError(
        'For Vue support the `@gql.tada/vue-support` package must be installed.\n' +
          'Install the package and try again.'
      );
    }
  }
  return _vue.transform(...args);
};

const checkVue = async (): Promise<void> => {
  if (!_vue) {
    try {
      _vue = await import('@gql.tada/vue-support');
    } catch (_error) {
      throw new TadaError(
        'For Vue support the `@gql.tada/vue-support` package must be installed.\n' +
          'Install the package and try again.'
      );
    }
  }
  return _vue.check();
};

export const transformExtensions = ['.svelte', '.vue'] as const;

export const transform = async (sourceFile: ts.SourceFile) => {
  const extname = path.extname(sourceFile.fileName);
  if (extname === '.svelte') {
    return transformSvelte(sourceFile);
  } else if (extname === '.vue') {
    await checkVue();
    return transformVue(sourceFile);
  } else {
    throw new TadaError(
      `Tried transforming unknown file type "${extname}". Supported: ${transformExtensions.join(
        ', '
      )}`
    );
  }
};
