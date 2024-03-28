import type { IntrospectionQuery, GraphQLSchema } from 'graphql';

export interface SchemaLoaderResult {
  introspection: IntrospectionQuery;
  schema: GraphQLSchema;
}

export type OnSchemaUpdate = (result: SchemaLoaderResult) => void;

export interface SchemaLoader {
  load(reload?: boolean): Promise<SchemaLoaderResult | null>;
  notifyOnUpdate(onUpdate: OnSchemaUpdate): () => void;

  /** @internal */
  loadIntrospection(): Promise<IntrospectionQuery | null>;
  /** @internal */
  loadSchema(): Promise<GraphQLSchema | null>;
}

export type SchemaOrigin =
  | string
  | {
      url: string;
      headers?: HeadersInit;
    };
