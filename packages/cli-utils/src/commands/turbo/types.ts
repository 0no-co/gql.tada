export interface TurboWarning {
  message: string;
  file: string;
  line: number;
  col: number;
}

export interface FileTurboSignal {
  kind: 'FILE_TURBO';
  filePath: string;
  cache: Record<string, string>;
  warnings: TurboWarning[];
}

export interface FileCountSignal {
  kind: 'FILE_COUNT';
  fileCount: number;
}

export interface WarningSignal {
  kind: 'WARNING';
  message: string;
}

export type TurboSignal = FileTurboSignal | FileCountSignal | WarningSignal;
