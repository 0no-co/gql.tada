import type ts from 'typescript';
import * as path from 'node:path';
import type { VirtualCode } from '@vue/language-core';

let _svelte: typeof import('./svelte');
let _vue: typeof import('./vue');

const transformSvelte = async (
  ...args: Parameters<typeof _svelte.transform>
): Promise<ReturnType<typeof _svelte.transform>> => {
  return (_svelte || (_svelte = await import('./svelte'))).transform(...args);
};

const transformVue = async (
  ...args: Parameters<typeof _vue.transform>
): Promise<ReturnType<typeof _vue.transform>> => {
  return (_vue || (_vue = await import('./vue'))).transform(...args);
};

const checkVue = async (): Promise<void> => {
  return (_vue || (_vue = await import('./vue'))).check();
};

export const transformExtensions = ['.svelte', '.vue'] as const;

export const transform = async (sourceFile: ts.SourceFile): Promise<VirtualCode | undefined> => {
  const extname = path.extname(sourceFile.fileName);
  if (extname === '.svelte') {
    return transformSvelte(sourceFile);
  } else if (extname === '.vue') {
    await checkVue();
    return transformVue(sourceFile);
  } else {
    throw new Error(
      `Tried transforming unknown file type "${extname}". Supported: ${transformExtensions.join(
        ', '
      )}`
    );
  }
};
