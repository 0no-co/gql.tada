import type { IntrospectionQuery, GraphQLSchema } from 'graphql';

export interface SchemaLoader {
  loadIntrospection(): Promise<IntrospectionQuery | null>;
  loadSchema(): Promise<GraphQLSchema | null>;
  notifyOnUpdate(onUpdate: () => void): () => void;
}
