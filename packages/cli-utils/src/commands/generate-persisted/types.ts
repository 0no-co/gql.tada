export interface PersistedWarning {
  message: string;
  file: string;
  line: number;
  col: number;
}

export interface FilePersistedSignal {
  kind: 'FILE_PERSISTED';
  filePath: string;
  documents: Record<string, string>;
  warnings: PersistedWarning[];
}

export interface FileCountSignal {
  kind: 'FILE_COUNT';
  fileCount: number;
}

export type PersistedSignal = FilePersistedSignal | FileCountSignal;
