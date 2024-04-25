import type { IntrospectionQuery, GraphQLSchema } from 'graphql';

export interface IntrospectionResult extends IntrospectionQuery {
  name: string | undefined;
}

export interface SchemaLoaderResult {
  introspection: IntrospectionResult;
  schema: GraphQLSchema;
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

export type SchemaOrigin =
  | string
  | {
      url: string;
      headers?: HeadersInit;
    };
