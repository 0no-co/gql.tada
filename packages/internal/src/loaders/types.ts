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

export interface SchemaLoader {
  readonly name: string | undefined;
  load(reload?: boolean): Promise<SchemaLoaderResult>;
  notifyOnUpdate(onUpdate: OnSchemaUpdate): () => void;

  /** @internal */
  loadIntrospection(): Promise<IntrospectionResult | null>;
  /** @internal */
  loadSchema(): Promise<GraphQLSchema | null>;
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
  autoupdate(onUpdate: (ref: SchemaRef<Result>, input: SingleSchemaInput) => void): () => void;
  /** Loads the initial result for the schema */
  load(): Promise<SchemaRef<SchemaLoaderResult>>;
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
