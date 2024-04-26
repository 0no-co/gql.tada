export interface PersistedWarning {
  message: string;
  file: string;
  line: number;
  col: number;
}

export interface PersistedDocument {
  schemaName: string | null;
  hashKey: string;
  document: string;
}

export interface FilePersistedSignal {
  kind: 'FILE_PERSISTED';
  filePath: string;
  documents: PersistedDocument[];
  warnings: PersistedWarning[];
}

export interface FileCountSignal {
  kind: 'FILE_COUNT';
  fileCount: number;
}

export interface WarningSignal {
  kind: 'EXTERNAL_WARNING';
}

export type PersistedSignal = FilePersistedSignal | FileCountSignal | WarningSignal;
