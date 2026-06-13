import type { OperationDefinitionNode, FragmentDefinitionNode } from 'graphql';
import type { GraphQLSPConfig } from '@gql.tada/internal';

export type SchemaName = string | null;

/** A warning surfaced while scanning a file or analysing a document. */
export interface ScanWarning {
  message: string;
  file: string;
  line: number;
  col: number;
}

/** A raw GraphQL document as discovered in a TypeScript source file.
 *
 * @remarks
 * This is the unit of data passed from the discovery worker ({@link _runScan})
 * to the analysis layer. It carries the unparsed document text alongside the
 * position it was found at, so the analysis layer can attribute it to a module. */
export interface RawScanDocument {
  schemaName: SchemaName;
  /** The raw GraphQL document text (the string passed to `graphql()`). */
  document: string;
  /** Absolute path of the module the document was defined in. */
  filePath: string;
  line: number;
  col: number;
  /** The raw inferred `TadaDocumentNode` type. Always measured; consumed by
   * rules that derive type-level metrics (kept internal, never serialised). */
  typeString?: string | undefined;
}

export interface FileCountSignal {
  kind: 'FILE_COUNT';
  fileCount: number;
}

export interface ExternalWarningSignal {
  kind: 'EXTERNAL_WARNING';
}

export interface FileScanSignal {
  kind: 'FILE_SCAN';
  filePath: string;
  documents: RawScanDocument[];
  imports: string[];
  warnings: ScanWarning[];
}

export type ScanSignal = FileCountSignal | ExternalWarningSignal | FileScanSignal;

export interface ScanParams {
  rootPath: string;
  tsconfigPath?: string;
  configPath: string;
  pluginConfig: GraphQLSPConfig;
}

/* -- Corpus (base facts) -------------------------------------------------- */

export interface SourceLocation {
  file: string;
  line: number;
  col: number;
}

export interface ModuleInfo {
  /** Absolute path of the module. */
  path: string;
  /** Path relative to the current working directory, for display. */
  relativePath: string;
  /** Ids of operations defined in this module. */
  operations: string[];
  /** Ids of fragments defined in this module. */
  fragments: string[];
  /** Absolute paths of other scanned modules this module imports. */
  imports: string[];
}

export type OperationKind = 'query' | 'mutation' | 'subscription';

/** Identity and syntactic facts about a discovered operation. Derived analysis
 * (field usage, depth, …) is owned by rules, not stored here. */
export interface OperationInfo {
  /** Stable id, e.g. `pokemon:operation:GetPokemon`. */
  id: string;
  name: string | null;
  kind: OperationKind;
  schemaName: SchemaName;
  /** Absolute path of the defining module. */
  module: string;
  loc: SourceLocation;
  /** Names of the operation's variables. */
  variables: string[];
  /** Names of fragments spread directly by the operation. */
  fragmentSpreads: string[];
  /** Hash of the normalised document, used to detect duplicates. */
  hash: string;
}

export interface FragmentInfo {
  /** Stable id, e.g. `pokemon:fragment:PokemonItem`. */
  id: string;
  name: string;
  typeCondition: string;
  schemaName: SchemaName;
  /** Absolute path of the defining module. */
  module: string;
  loc: SourceLocation;
  fragmentSpreads: string[];
  hash: string;
}

/** A discovered operation or fragment, paired with its AST node. Held by the
 * {@link ScanContext} and traversed by rules. `defKind` discriminates the union
 * (distinct from `OperationInfo.kind`, which is the GraphQL operation kind). */
export type DefinitionRecord =
  | ({ defKind: 'operation'; node: OperationDefinitionNode } & OperationInfo)
  | ({ defKind: 'fragment'; node: FragmentDefinitionNode } & FragmentInfo);

/** The base facts of a scan: identities only, no derived analysis. */
export interface ScanCorpus {
  schemas: SchemaName[];
  modules: ModuleInfo[];
  operations: OperationInfo[];
  fragments: FragmentInfo[];
  warnings: ScanWarning[];
}

/* -- Graph (composed from corpus + the field-usage rule at output time) --- */

export type ScanGraphNodeKind = 'module' | 'operation' | 'fragment' | 'schemaType' | 'schemaField';

export interface ScanGraphNode {
  id: string;
  kind: ScanGraphNodeKind;
  label: string;
}

export type ScanGraphEdgeKind = 'defines' | 'spreads' | 'selects' | 'onType' | 'imports';

export interface ScanGraphEdge {
  from: string;
  to: string;
  kind: ScanGraphEdgeKind;
}

export interface ScanGraph {
  nodes: ScanGraphNode[];
  edges: ScanGraphEdge[];
}

/* -- Rules layer ---------------------------------------------------------- */

export type DatapointRef =
  | { kind: 'field'; coordinate: string }
  | { kind: 'type'; name: string }
  | { kind: 'operation'; id: string }
  | { kind: 'fragment'; id: string }
  | { kind: 'module'; path: string; line?: number; col?: number };

export interface RuleDatapoint<T = unknown> {
  ref: DatapointRef;
  message: string;
  data: T;
  /** Optional relative importance, e.g. how much of the codebase depends on the
   * referenced thing. Used to rank and to weight the graph. */
  weight?: number;
}

/** A running instance of a rule, bound to a {@link ScanContext}.
 *
 * @remarks
 * Modelled on graphql-js validation rules: the rule owns its state in a
 * closure, accumulates it through its `visitor` during a single shared
 * traversal, and converts that state to datapoints in `collect()`. A rule
 * never reads another rule's output or a shared derived structure — only the
 * primitives the context exposes. */
export interface ScanRuleInstance<T = unknown> {
  /** AST visitor merged into the shared parallel traversal. */
  readonly visitor: import('graphql').ASTVisitor;
  /** Converts the accumulated state into datapoints once traversal completes. */
  collect(): RuleDatapoint<T>[];
}

export interface ScanRule<T = unknown> {
  name: string;
  description: string;
  create(context: import('./context').ScanContext): ScanRuleInstance<T>;
}

export type RuleResults = Record<string, RuleDatapoint[]>;
