import { describe, it, expectTypeOf } from 'vitest';
import type { GraphQLSchema } from 'graphql';

import type { ResultOf, VariablesOf } from '../../api';
import { initGraphQLTada } from '../../api';
import type {
  IntrospectionOf,
  TadaSchema,
  TadaSchemaCarrier,
  TadaNamedTypeRef,
  TadaNonNullTypeRef,
  TadaListTypeRef,
  TadaObjectType,
  TadaInterfaceType,
  TadaUnionType,
  TadaEnumType,
  TadaScalarType,
  TadaInputObjectType,
} from '../contract';

// A schema as a third-party builder (e.g. Pothos or Grats) would emit it
type ID = TadaNonNullTypeRef<TadaNamedTypeRef<'SCALAR', 'ID'>>;
type String = TadaNamedTypeRef<'SCALAR', 'String'>;

type schema = TadaSchema<{
  query: 'Query';
  mutation: 'Mutation';
  types:
    | TadaScalarType<'Date', string>
    | TadaEnumType<'Status', 'DRAFT' | 'PUBLISHED'>
    | TadaInterfaceType<'Node', { id: ID }, 'Article'>
    | TadaObjectType<
        'Article',
        {
          id: ID;
          title: TadaNonNullTypeRef<String>;
          status: TadaNamedTypeRef<'ENUM', 'Status'>;
          published: TadaNamedTypeRef<'SCALAR', 'Date'>;
          tags: TadaNonNullTypeRef<TadaListTypeRef<TadaNonNullTypeRef<String>>>;
        }
      >
    | TadaObjectType<'Video', { id: ID; url: String }>
    | TadaUnionType<'Media', 'Article' | 'Video'>
    | TadaInputObjectType<
        'ArticleInput',
        {
          title: TadaNonNullTypeRef<String>;
          status: TadaNonNullTypeRef<TadaNamedTypeRef<'ENUM', 'Status'>>;
        },
        'status'
      >
    | TadaInputObjectType<
        'ArticleBy',
        { id: TadaNamedTypeRef<'SCALAR', 'ID'>; slug: String },
        never,
        true
      >
    | TadaObjectType<
        'Query',
        {
          node: TadaNamedTypeRef<'INTERFACE', 'Node'>;
          media: TadaNonNullTypeRef<TadaListTypeRef<TadaNamedTypeRef<'UNION', 'Media'>>>;
          article: TadaNamedTypeRef<'OBJECT', 'Article'>;
        }
      >
    | TadaObjectType<
        'Mutation',
        { createArticle: TadaNonNullTypeRef<TadaNamedTypeRef<'OBJECT', 'Article'>> }
      >;
}>;

describe('contract', () => {
  const graphql = initGraphQLTada<{ introspection: schema }>();

  it('types results of objects, interfaces, unions, enums, scalars, and lists', () => {
    const query = graphql(`
      query {
        node {
          id
          ... on Article {
            title
          }
        }
        media {
          __typename
          ... on Article {
            status
            published
            tags
          }
          ... on Video {
            url
          }
        }
        article {
          id
        }
      }
    `);
    expectTypeOf<ResultOf<typeof query>>().toEqualTypeOf<{
      node: { __typename?: 'Article'; id: string; title: string } | null;
      media: (
        | {
            __typename: 'Article';
            status: 'DRAFT' | 'PUBLISHED' | null;
            published: string | null;
            tags: string[];
          }
        | { __typename: 'Video'; url: string | null }
        | null
      )[];
      article: { id: string } | null;
    }>();
  });

  it('types variables of input objects with defaults and OneOf Input Objects', () => {
    const mutation = graphql(`
      mutation ($input: ArticleInput!, $by: ArticleBy!) {
        createArticle {
          id
        }
      }
    `);
    expectTypeOf<VariablesOf<typeof mutation>>().toEqualTypeOf<{
      input: { title: string; status?: 'DRAFT' | 'PUBLISHED' | null };
      by: { id: string } | { slug: string };
    }>();
  });

  it('extracts the schema type from a schema object carrying it', () => {
    // e.g. a builder's `toSchema()` return type
    interface BuiltSchema extends TadaSchemaCarrier<schema> {
      readonly config: unknown;
    }
    expectTypeOf<IntrospectionOf<BuiltSchema>>().toEqualTypeOf<schema>();
  });

  it('rejects schema objects without a schema type', () => {
    // @ts-expect-error: doesn't carry a schema type
    expectTypeOf<IntrospectionOf<{ config: unknown }>>();
    // @ts-expect-error: e.g. when a schema is annotated as a plain `GraphQLSchema`
    expectTypeOf<IntrospectionOf<GraphQLSchema>>();
  });

  it('ignores optional and readonly modifiers of fields', () => {
    type String = TadaNamedTypeRef<'SCALAR', 'String'>;
    type optionalSchema = TadaSchema<{
      query: 'Query';
      types:
        | TadaObjectType<'Query', { readonly a?: TadaNonNullTypeRef<String>; b?: String }>
        | TadaInputObjectType<'Input', { readonly a?: TadaNonNullTypeRef<String>; b?: String }>;
    }>;
    const graphql = initGraphQLTada<{ introspection: optionalSchema }>();
    const query = graphql(`
      query ($input: Input!) {
        a
        b
      }
    `);
    expectTypeOf<ResultOf<typeof query>>().toEqualTypeOf<{ a: string; b: string | null }>();
    expectTypeOf<VariablesOf<typeof query>>().toEqualTypeOf<{
      input: { a: string; b?: string | null };
    }>();
  });
});
