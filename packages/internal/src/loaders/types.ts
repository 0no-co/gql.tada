import type { IntrospectionQuery, GraphQLSchema } from 'graphql';

export interface SchemaLoader {
  loadIntrospection(reload?: boolean): Promise<IntrospectionQuery | null>;
  loadSchema(reload?: boolean): Promise<GraphQLSchema | null>;
  notifyOnUpdate(onUpdate: () => void): () => void;
}
