import type ts from 'typescript';
import { SourceMap } from '@volar/source-map';
import type { Mapping } from '@volar/source-map';

export type VirtualMap = Map<string, SourceMappedFile>;
export type { Mapping };

export interface FileSpan extends ts.TextSpan {
  fileName: string;
}

export class SourceMappedFile extends SourceMap {
  readonly sourceFile: ts.SourceFile;
  readonly sourceFileId: string;
  readonly generatedFileId: string;

  constructor(
    mappings: readonly Mapping[],
    params: {
      sourceFile: ts.SourceFile;
      sourceFileId: string;
      generatedFileId: string;
    }
  ) {
    super(mappings as Mapping[]);
    this.sourceFile = params.sourceFile;
    this.sourceFileId = params.sourceFileId;
    this.generatedFileId = params.generatedFileId;
  }

  getSourceSpan(span: ts.TextSpan | number): FileSpan {
    const sourceStart = this.getSourceOffset(typeof span === 'number' ? span : span.start);
    if (sourceStart != null) {
      const sourceEnd =
        typeof span !== 'number' ? this.getSourceOffset(span.start + span.length - 1) : null;
      return {
        fileName: this.sourceFileId,
        start: sourceStart[0],
        length:
          sourceEnd != null
            ? sourceEnd[0] - sourceStart[0] + 1
            : typeof span !== 'number'
              ? span.length
              : 1,
      };
    } else {
      return {
        fileName: this.generatedFileId,
        start: typeof span !== 'number' ? span.start : span,
        length: typeof span !== 'number' ? span.length : 1,
      };
    }
  }
}
