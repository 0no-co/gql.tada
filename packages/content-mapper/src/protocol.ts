// Content mapper protocol (version 1) as spoken by TypeScript 7.1+ over stdio.
// The enums are inlined, since `typescript@7` doesn't expose a stable runtime API
// we could import them from, and the mapper must not depend on the user's TypeScript.

export type PositionEncoding = 'utf-8' | 'utf-16';

export interface InitializeParams {
  positionEncodings: PositionEncoding[];
  locale?: string;
}

export interface InitializeResult {
  protocolVersion: 1;
  positionEncoding: PositionEncoding;
  diagnosticSource: string;
}

export interface OpenProjectParams {
  /** Absolute tsconfig path, or an empty string for a project without a config file. */
  configFileName: string;
  projectHandle: string;
  /** The `options` object of this mapper's `contentMappers` entry. */
  options?: Record<string, unknown>;
  compilerOptions: Record<string, unknown>;
}

export interface OptionDiagnostic {
  path: (string | number)[];
  messageText: string;
  code: number;
}

export interface OpenProjectResult {
  /** Fingerprint of configuration read outside of `options`. Required with `dynamicConfig`. */
  configIdentity?: string;
  /** Absolute files whose changes may alter `configIdentity` or transform output. */
  watchedFiles?: string[];
  optionDiagnostics?: OptionDiagnostic[];
}

export interface TransformParams {
  fileName: string;
  content: string;
  projectHandle: string;
}

export interface CloseProjectParams {
  projectHandle: string;
}

export enum SpanMapKind {
  /** Same length and content in virtual and original text. */
  Verbatim = 0,
  Atom = 1,
  /** Different virtual text, but diagnostics display the original text. */
  Alias = 2,
}

export enum SpanMapFeature {
  None = 0,
  Hover = 1 << 0,
  SignatureHelp = 1 << 1,
  Completion = 1 << 2,
  Definition = 1 << 3,
  TypeDefinition = 1 << 4,
  Implementation = 1 << 5,
  References = 1 << 6,
  DocumentHighlights = 1 << 7,
  Rename = 1 << 8,
  CallHierarchy = 1 << 9,
  CodeActions = 1 << 10,
  Formatting = 1 << 11,
  InlayHints = 1 << 12,
  SemanticTokens = 1 << 13,
  FoldingRanges = 1 << 14,
  SelectionRanges = 1 << 15,
  LinkedEditing = 1 << 16,
  AutoInsert = 1 << 17,
  DocumentSymbols = 1 << 18,
  CodeLens = 1 << 19,
  All = (1 << 20) - 1,
}

export type SpanMapping = [
  virtualStart: number,
  virtualLength: number,
  originalStart: number,
  originalLength: number,
  kind: SpanMapKind,
  features?: SpanMapFeature,
];

export interface MapperDiagnostic {
  messageText: string;
  start: number;
  length: number;
  code: number;
}

export interface TransformResult {
  text: string;
  extension: '.ts';
  mappings?: SpanMapping[];
  diagnostics?: MapperDiagnostic[];
}
