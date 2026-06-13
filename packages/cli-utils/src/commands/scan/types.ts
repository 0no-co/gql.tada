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
 * to the metadata layer. It carries the unparsed document text alongside the
 * position it was found at, so the metadata layer can attribute it to a module. */
export interface RawScanDocument {
  schemaName: SchemaName;
  /** The raw GraphQL document text (the string passed to `graphql()`). */
  document: string;
  /** Absolute path of the module the document was defined in. */
  filePath: string;
  line: number;
  col: number;
  /** The inferred `TadaDocumentNode` type, when `--measure-types` is set. */
  typeString?: string | undefined;
  /** Length of {@link typeString}, used as a proxy for type-inference cost. */
  typeSize?: number | undefined;
}

/** An import edge between modules, used to build the module import graph. */
export interface ScanModuleImports {
  /** Absolute path of the importing module. */
  filePath: string;
  /** Resolved absolute paths of imported modules. */
  resolved: string[];
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
  /** When set, the worker evaluates each document's inferred type to record its size. */
  measureTypes: boolean;
}

/* -- Metadata layer ------------------------------------------------------- */

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
  /** Schema coordinates (`Type.field`) selected directly by the operation. */
  fields: string[];
  /** Maximum selection-set nesting depth. */
  depth: number;
  /** Total number of field selections. */
  fieldCount: number;
  /** Hash of the normalised document, used to detect duplicates. */
  hash: string;
  /** Size of the inferred TypeScript type, when measured. */
  typeSize?: number | undefined;
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
  fields: string[];
  hash: string;
}

export interface FieldUsage {
  /** Id of the operation or fragment that selects the field. */
  defId: string;
  /** Absolute path of the module the selection lives in. */
  module: string;
}

export interface FieldIndexEntry {
  /** `Type.field`. */
  coordinate: string;
  typeName: string;
  fieldName: string;
  /** String representation of the field's return type. */
  fieldType: string;
  deprecated: boolean;
  deprecationReason?: string | undefined;
  /** Direct selections of this field, one per operation/fragment definition. */
  directUsages: FieldUsage[];
  /** `directUsages.length`. */
  count: number;
  /** Operation ids that reach this field directly or transitively via fragments. */
  operations: string[];
}

export interface TypeCoverage {
  typeName: string;
  totalFields: number;
  usedFields: number;
}

export interface SchemaCoverage {
  totalFields: number;
  usedFields: number;
  perType: TypeCoverage[];
}

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

/** The full set of facts collected by a scan.
 *
 * @remarks
 * This is the "metadata layer". It is built purely from discovered documents
 * and the schema, and passes through to the JSON output unchanged. The "rules
 * layer" derives insights from it, and the "output layer" renders it. */
export interface ScanMetadata {
  schemas: SchemaName[];
  modules: ModuleInfo[];
  operations: OperationInfo[];
  fragments: FragmentInfo[];
  fieldIndex: Record<string, FieldIndexEntry>;
  coverage: SchemaCoverage;
  graph: ScanGraph;
  warnings: ScanWarning[];
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
}

/** A named insight derived purely from {@link ScanMetadata}.
 *
 * @remarks
 * Each rule emits a list of datapoints. A datapoint declares what it refers to
 * (a schema field/type, a module + line, a fragment, an operation) via its
 * `ref`, so the rule itself carries no grouping/family. Adding an insight is a
 * matter of writing one rule and registering it in `DEFAULT_RULES`. */
export interface ScanRule<T = unknown> {
  name: string;
  description: string;
  run(metadata: ScanMetadata): RuleDatapoint<T>[];
}

export type RuleResults = Record<string, RuleDatapoint[]>;
