export interface TurboWarning {
  message: string;
  file: string;
  line: number;
  col: number;
}

export interface TurboDocument {
  schemaName: string | null;
  argumentKey: string;
  documentType: string;
}

export interface FileTurboSignal {
  kind: 'FILE_TURBO';
  filePath: string;
  documents: TurboDocument[];
  warnings: TurboWarning[];
}

export interface FileCountSignal {
  kind: 'FILE_COUNT';
  fileCount: number;
}

export interface WarningSignal {
  kind: 'EXTERNAL_WARNING';
}

export type TurboSignal = FileTurboSignal | FileCountSignal | WarningSignal;
