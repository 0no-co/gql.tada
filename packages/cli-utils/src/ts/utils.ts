import type ts from 'typescript';

export interface SourcePosition {
  fileName: string;
  line: number;
  col: number;
  endLine: number | undefined;
  endColumn: number | undefined;
}

export const spanToFilePosition = (
  file: ts.SourceFile,
  span: ts.TextSpan | number
): SourcePosition => {
  const output: SourcePosition = {
    fileName: file.fileName,
    line: 1,
    col: 1,
    endLine: undefined,
    endColumn: undefined,
  };
  let lineAndChar = file.getLineAndCharacterOfPosition(
    typeof span === 'number' ? span : span.start
  );
  output.line = lineAndChar.line + 1;
  output.col = lineAndChar.character + 1;
  if (typeof span !== 'number' && span.length > 1) {
    lineAndChar = file.getLineAndCharacterOfPosition(span.start + span.length - 1);
    output.endLine = lineAndChar.line + 1;
    output.endColumn = lineAndChar.character + 1;
  }
  return output;
};
