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

export interface GraphQLSourceImport {
  specifier: string;
  importClause: string;
}

export interface GraphQLSourceFile {
  absolutePath: string;
  imports: GraphQLSourceImport[];
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

export interface GraphQLSourceSignal {
  kind: 'GRAPHQL_SOURCES';
  sources: GraphQLSourceFile[];
}

export type TurboSignal = FileTurboSignal | FileCountSignal | WarningSignal | GraphQLSourceSignal;
