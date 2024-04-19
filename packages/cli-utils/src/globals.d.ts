import * as _tsMorph from 'ts-morph';

declare module '@ts-morph/common' {
  export const ts: typeof import('typescript/lib/tsserverlibrary');
}

declare module 'ts-morph' {
  export const ts: typeof import('typescript/lib/tsserverlibrary');

  interface SourceFile {
    version: unknown;
  }
}
