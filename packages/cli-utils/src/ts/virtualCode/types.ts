import type { IScriptSnapshot, SourceFile } from 'typescript';
import type { VirtualCode } from '@vue/language-core';

export interface CreateVirtualCode<ReturnT = VirtualCode | undefined> {
  (
    fileId: string,
    snapshot: IScriptSnapshot,
    ts: typeof import('typescript/lib/tsserverlibrary')
  ): ReturnT;
}

export type AsyncCreateVirtualCode = CreateVirtualCode<Promise<VirtualCode | undefined>>;

export interface FilePosition {
  isVirtual: boolean;
  fileId: string;
  position: number;
  file: SourceFile;
}

export type TranslatePosition = (fileId: string, position?: number) => FilePosition | undefined;
