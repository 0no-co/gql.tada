import type { SourceFile } from 'typescript';
import type { TranslatePosition, FilePosition } from './virtualCode';

export interface Position {
  file: string;
  line: number;
  col: number;
  endLine: number | undefined;
  endColumn: number | undefined;
}

export const getFilePosition = (
  file: SourceFile,
  start?: number | undefined,
  length?: number | undefined,
  getVirtualPosition?: TranslatePosition
): Position => {
  const output: Position = {
    file: file.fileName,
    line: 1,
    col: 1,
    endLine: undefined,
    endColumn: undefined,
  };

  let end = start != null && length != null ? start + length - 1 : undefined;
  if (getVirtualPosition) {
    let originalPosition: FilePosition | undefined;
    if (
      (originalPosition = getVirtualPosition(file.fileName, start)) &&
      !originalPosition.isVirtual
    ) {
      output.file = originalPosition.fileId;
      file = originalPosition.file;
      start = originalPosition.position;
      if (end != null && (originalPosition = getVirtualPosition(file.fileName, end))) {
        end = originalPosition.position;
      }
    }
  }

  if (start) {
    let lineAndChar = file.getLineAndCharacterOfPosition(start);
    output.line = lineAndChar.line + 1;
    output.col = lineAndChar.character + 1;
    if (end != null) {
      lineAndChar = file.getLineAndCharacterOfPosition(end);
      output.endLine = lineAndChar.line + 1;
      output.endColumn = lineAndChar.character + 1;
    }
  }

  return output;
};
