export interface TextSpan {
  start: number;
  length: number;
}

export interface TextChangeRange {
  span: TextSpan;
  newLength: number;
}

export interface IScriptSnapshot {
  /** Gets a portion of the script snapshot specified by [start, end). */
  getText(start: number, end: number): string;
  /** Gets the length of this script snapshot. */
  getLength(): number;
  /**
   * Gets the TextChangeRange that describe how the text changed between this text and
   * an older version.  This information is used by the incremental parser to determine
   * what sections of the script need to be re-parsed.  'undefined' can be returned if the
   * change range cannot be determined.  However, in that case, incremental parsing will
   * not happen and the entire document will be re - parsed.
   */
  getChangeRange(oldSnapshot: IScriptSnapshot): TextChangeRange | undefined;
  /** Releases all resources held by this script snapshot */
  dispose?(): void;
}

export interface CodeInformation {
  /** virtual code is expected to support verification */
  verification?:
    | boolean
    | {
        shouldReport?(): boolean;
      };
  /** virtual code is expected to support assisted completion */
  completion?:
    | boolean
    | {
        isAdditional?: boolean;
        onlyImport?: boolean;
      };
  /** virtual code is expected correctly reflect semantic of the source code */
  semantic?:
    | boolean
    | {
        shouldHighlight?(): boolean;
      };
  /** virtual code is expected correctly reflect reference relationships of the source code */
  navigation?:
    | boolean
    | {
        shouldRename?(): boolean;
        resolveRenameNewName?(newName: string): string;
        resolveRenameEditText?(newText: string): string;
      };
  /** virtual code is expected correctly reflect the structural information of the source code */
  structure?: boolean;
  /** virtual code is expected correctly reflect the format information of the source code */
  format?: boolean;
}

export interface Mapping<Data = unknown> {
  sourceOffsets: number[];
  generatedOffsets: number[];
  lengths: number[];
  generatedLengths?: number[];
  data: Data;
}

export type CodeMapping = Mapping<CodeInformation>;

export interface VirtualCode {
  id: string;
  languageId: string;
  snapshot: IScriptSnapshot;
  mappings: CodeMapping[];
  associatedScriptMappings?: Map<unknown, CodeMapping[]>;
  embeddedCodes?: VirtualCode[];
  linkedCodeMappings?: Mapping[];
}
