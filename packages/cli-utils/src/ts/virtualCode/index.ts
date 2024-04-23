import ts from 'typescript';
import { SourceMap } from '@volar/source-map';

import type { ProgramFactory } from '../factory';
import type { AsyncCreateVirtualCode, TranslatePosition } from './types';
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

export const loadVirtualCode = async (
  factory: ProgramFactory
): Promise<TranslatePosition | undefined> => {
  const projectFiles = await scanProjectFiles(
    factory.projectDirectories,
    (filepath) => !!getVirtualType(filepath)
  );

  if (!projectFiles.length) return undefined;

  const projectToVirtual = new Map<string, ts.SourceFile>();
  const virtualToProject = new Map<string, ts.SourceFile>();
  const sourceMaps = new Map<string, SourceMap>();

  for (const file of projectFiles) {
    const projectSourceFile = factory.createSourceFile({
      fileId: file.fileId,
      sourceText: file.snapshot,
      scriptKind: ts.ScriptKind.External,
    });

    const virtualCode = await createVirtualCode(file.fileId, file.snapshot, ts);
    const virtualSnapshot = virtualCode && virtualCode.snapshot;
    if (!virtualCode || !virtualSnapshot) continue;

    const sourceMap = new SourceMap(virtualCode.mappings);
    const virtualFileId = file.fileId + VIRTUAL_EXT;
    const virtualSourceFile = factory.createSourceFile({
      fileId: virtualFileId,
      sourceText: virtualSnapshot,
    });

    factory.addSourceFile(virtualSourceFile, true);
    projectToVirtual.set(file.fileId, virtualSourceFile);
    virtualToProject.set(virtualFileId, projectSourceFile);
    sourceMaps.set(file.fileId, sourceMap);
    sourceMaps.set(virtualFileId, sourceMap);
  }

  return ((fileId, position) => {
    let sourceFile: ts.SourceFile | undefined;
    let sourceMap: SourceMap | undefined;
    if ((sourceFile = projectToVirtual.get(fileId)) && (sourceMap = sourceMaps.get(fileId))) {
      const generatedPosition = position != null ? sourceMap.getGeneratedOffset(position) : null;
      return {
        fileId: sourceFile.fileName,
        file: sourceFile,
        position: generatedPosition ? generatedPosition[0] : position || 0,
        isVirtual: true,
      };
    } else if (
      (sourceFile = virtualToProject.get(fileId)) &&
      (sourceMap = sourceMaps.get(fileId))
    ) {
      const sourcePosition = position != null ? sourceMap.getSourceOffset(position) : null;
      return {
        fileId: sourceFile.fileName,
        file: sourceFile,
        position: sourcePosition ? sourcePosition[0] : position || 0,
        isVirtual: false,
      };
    }
  }) satisfies TranslatePosition;
};
