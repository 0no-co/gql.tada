import ts from 'typescript';

import type { ProgramFactory } from '../factory';
import type { AsyncCreateVirtualCode } from './types';
import type { ScannedFile } from './scan';
import { scanProjectFiles } from './scan';

let _svelte: typeof import('./svelte') | undefined;
let _vue: typeof import('./vue') | undefined;

const svelte = async () => _svelte || (_svelte = await import('./svelte'));
const vue = async () => _vue || (_vue = await import('./vue'));

const VIRTUAL_EXT = '.ts';

const getVirtualType = (filepath: string): 'vue' | 'svelte' | undefined => {
  if (filepath.endsWith('.vue')) {
    return 'vue';
  } else if (filepath.endsWith('.svelte')) {
    return 'svelte';
  }
};

const createVirtualCode: AsyncCreateVirtualCode = async (fileId, snapshot, ts) => {
  const type = getVirtualType(fileId);
  if (type === 'vue') {
    return (await vue()).createVirtualCode(fileId, snapshot, ts);
  } else if (type === 'svelte') {
    return (await svelte()).createVirtualCode(fileId, snapshot, ts);
  }
};

export * from './types';

export const loadVirtualCode = async (factory: ProgramFactory): Promise<readonly ScannedFile[]> => {
  const projectFiles = await scanProjectFiles(
    factory.projectDirectories,
    (filepath) => !!getVirtualType(filepath)
  );

  for (const file of projectFiles) {
    const virtualCode = await createVirtualCode(file.fileId, file.sourceText, ts);
    const virtualFileId = file.fileId + VIRTUAL_EXT;

    if (virtualCode) {
      factory
        .addSourceFile(
          {
            fileId: virtualFileId,
            sourceText: virtualCode.snapshot,
          },
          /*addRootName*/ true
        )
        .addMappedFile(file, {
          mappings: virtualCode.mappings,
          fileId: virtualFileId,
        });
    }
  }

  return projectFiles;
};
