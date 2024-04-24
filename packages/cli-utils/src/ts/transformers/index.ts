import type ts from 'typescript';
import * as path from 'node:path';
import type { VirtualCode } from '@vue/language-core';

let _transformSvelte: typeof import('./svelte').transform;
let _transformVue: typeof import('./vue').transform;

const transformSvelte = async (
  ...args: Parameters<typeof _transformSvelte>
): Promise<ReturnType<typeof _transformSvelte>> => {
  if (!_transformSvelte) _transformSvelte = (await import('./svelte')).transform;
  return _transformSvelte(...args);
};

const transformVue = async (
  ...args: Parameters<typeof _transformVue>
): Promise<ReturnType<typeof _transformVue>> => {
  if (!_transformVue) _transformVue = (await import('./vue')).transform;
  return _transformVue(...args);
};

export const transformExtensions = ['.svelte', '.vue'] as const;

export const transform = (sourceFile: ts.SourceFile): Promise<VirtualCode | undefined> => {
  const extname = path.extname(sourceFile.fileName);
  if (extname === '.svelte') {
    return transformSvelte(sourceFile);
  } else if (extname === '.vue') {
    return transformVue(sourceFile);
  } else {
    throw new Error(
      `Tried transforming unknown file type "${extname}". Supported: ${transformExtensions.join(
        ', '
      )}`
    );
  }
};
