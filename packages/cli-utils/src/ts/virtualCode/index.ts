import type * as ts from 'typescript';
import { SourceMap } from '@volar/source-map';
import type { Project } from 'ts-morph';

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
  projectPath: string,
  project: Project,
  ts: typeof import('typescript/lib/tsserverlibrary')
): Promise<TranslatePosition | undefined> => {
  const projectFiles = await scanProjectFiles(
    [projectPath, ...project.getRootDirectories().map((path) => path.getPath())],
    (filepath) => !!getVirtualType(filepath),
    ts
  );

  if (!projectFiles.length) return undefined;

  const projectToVirtual = new Map<string, ts.SourceFile>();
  const virtualToProject = new Map<string, ts.SourceFile>();
  const sourceMaps = new Map<string, SourceMap>();

  for (const file of projectFiles) {
    const projectSourceFile = ts.createSourceFile(
      file.fileId,
      file.snapshot.getText(0, file.snapshot.getLength()),
      ts.ScriptTarget.ESNext,
      false,
      ts.ScriptKind.External
    );

    const virtualCode = await createVirtualCode(file.fileId, file.snapshot, ts);
    const virtualSnapshot = virtualCode && virtualCode.snapshot;
    if (!virtualCode || !virtualSnapshot) continue;

    const sourceMap = new SourceMap(virtualCode.mappings);
    const virtualFileId = file.fileId + VIRTUAL_EXT;
    const virtualSourceFile = project.createSourceFile(
      virtualFileId,
      virtualSnapshot.getText(0, virtualSnapshot.getLength()),
      { overwrite: true, scriptKind: ts.ScriptKind.TSX }
    );

    if (virtualSourceFile._markAsInProject) virtualSourceFile._markAsInProject();

    projectToVirtual.set(file.fileId, virtualSourceFile.compilerNode);
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
