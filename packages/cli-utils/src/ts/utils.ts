import type { SourceFile } from 'typescript';

export interface Position {
  line: number;
  col: number;
  endLine: number | undefined;
  endColumn: number | undefined;
}

export const getFilePosition = (
  file: SourceFile,
  start?: number | undefined,
  length?: number | undefined
): Position => {
  const output: Position = { line: 1, col: 1, endLine: undefined, endColumn: undefined };
  if (start) {
    let lineAndChar = file.getLineAndCharacterOfPosition(start);
    output.line = lineAndChar.line + 1;
    output.col = lineAndChar.character + 1;
    if (length) {
      lineAndChar = file.getLineAndCharacterOfPosition(start + length - 1);
      output.endLine = lineAndChar.line + 1;
      output.endColumn = lineAndChar.character + 1;
    }
  }
  return output;
};
