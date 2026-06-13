import type { IntrospectionQuery, GraphQLSchema } from 'graphql';

export interface IntrospectionResult extends IntrospectionQuery {
  name: string | undefined;
}

export interface SchemaLoaderResult {
  introspection: IntrospectionResult;
  schema: GraphQLSchema;
  tadaOutputLocation?: string;
  tadaTurboLocation?: string;
  tadaPersistedLocation?: string;
}

export type OnSchemaUpdate = (result: SchemaLoaderResult) => void;
export type OnSchemaError = (error: Error) => void;

export interface SchemaLoader {
  readonly name: string | undefined;
  load(reload?: boolean): Promise<SchemaLoaderResult>;
  notifyOnUpdate(onUpdate: OnSchemaUpdate, onError?: OnSchemaError): () => void;

  /** @internal */
  loadIntrospection(): Promise<IntrospectionResult | null>;
  /** @internal */
  loadSchema(): Promise<GraphQLSchema | null>;
}

export interface BaseLoadConfig {
  rootPath?: string;
  fetchInterval?: number;
  assumeValid?: boolean;
}

export type SingleSchemaInput = {
  name?: string;
  schema: SchemaOrigin;
  tadaOutputLocation?: string;
  tadaTurboLocation?: string;
  tadaPersistedLocation?: string;
};

export type MultiSchemaInput = { schemas?: SingleSchemaInput[] };

export interface SchemaRef<Result = SchemaLoaderResult | null> {
  /** Starts automatically updating the ref */
  autoupdate(
    config: BaseLoadConfig,
    onUpdate: (ref: SchemaRef<Result>, input: SingleSchemaInput) => void,
    onError?: (error: Error, input: SingleSchemaInput) => void
  ): () => void;
  /** Loads the initial result for the schema.
   * Loaders cache their last successful result; pass `reload` to force
   * re-reading schemas, e.g. when a file watcher may have missed events. */
  load(config: BaseLoadConfig & { reload?: boolean }): Promise<SchemaRef<SchemaLoaderResult>>;
  current: Result;
  multi: { [name: string]: Result };
  version: number;
}

export type SchemaOrigin =
  | string
  | {
      url: string;
      headers?: HeadersInit;
    };
