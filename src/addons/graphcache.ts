import type { GraphQLTadaAPI } from '../api';
import type { SchemaLike } from '../introspection';
import type { obj } from '../utils';

declare const graphCacheReference: unique symbol;

type GraphCacheScalar = null | number | boolean | string | GraphCacheScalarObject;

interface GraphCacheScalarObject {
  constructor?: Function;
  [key: string]: any;
}

type GraphCacheNullArray<T> = Array<null | T | GraphCacheNullArray<T>>;

type GraphCacheDataField =
  | GraphCacheScalar
  | GraphCacheData
  | GraphCacheNullArray<GraphCacheScalar>
  | GraphCacheNullArray<GraphCacheData>;

interface GraphCacheSystemFields {
  __typename: string;
  _id?: string | number | null;
  id?: string | number | null;
}

interface GraphCacheDataFields {
  [fieldName: string]: GraphCacheDataField;
}

type GraphCacheData = GraphCacheSystemFields & GraphCacheDataFields;

type GraphCacheVariables = {
  [name: string]:
    | GraphCacheScalar
    | GraphCacheScalar[]
    | GraphCacheVariables
    | GraphCacheNullArray<GraphCacheVariables>;
};

type GraphCacheFieldArgs = GraphCacheVariables | null | undefined;

interface GraphCacheFieldInfo {
  fieldKey: string;
  fieldName: string;
  arguments: GraphCacheVariables | null;
}

interface GraphCacheFragments {
  [fragmentName: string]: void | unknown;
}

interface GraphCacheResolveInfo {
  parent: GraphCacheData;
  parentTypeName: string;
  parentKey: string;
  parentFieldKey: string;
  fieldName: string;
  fragments: GraphCacheFragments;
  variables: GraphCacheVariables;
  error: unknown;
  partial?: boolean;
  optimistic?: boolean;
  __internal?: unknown;
}

type GraphCacheLink<Key = string> = null | Key | GraphCacheNullArray<Key>;

type GraphCacheEntity = undefined | null | GraphCacheData | string;

type SchemaOf<T> =
  T extends GraphQLTadaAPI<infer Schema, any> ? Schema : T extends SchemaLike ? T : never;

type TypeMap<Schema extends SchemaLike> = Schema['types'];

type TypeOf<Schema extends SchemaLike, Name> = Name extends keyof TypeMap<Schema>
  ? TypeMap<Schema>[Name]
  : never;

type GraphCacheDepth = [1, 1, 1, 1, 1, 1];

type GraphCacheDecrement<Depth extends readonly unknown[]> = Depth extends readonly [
  unknown,
  ...infer Rest,
]
  ? Rest
  : [];

// NOTE: Collecting the names of all object types forces every type of the schema to be
// evaluated, which is quadratic for unprocessed introspection types. Instead, configs are
// keyed by all type names and `ifObjectType` resolves non-object types to `never` lazily
type TypeNames<Schema extends SchemaLike> = keyof TypeMap<Schema> & string;

type ifObjectType<Schema extends SchemaLike, TypeName, T, Fallback = never> =
  TypeOf<Schema, TypeName> extends { kind: 'OBJECT'; fields: any } ? T : Fallback;

// NOTE: Graphcache's `KeyingConfig` doesn't accept `undefined` values, which an optional
// `never` property resolves to. This rejects any key generator but stays compatible with it
type GraphCacheInvalidKeyGenerator = {
  bivarianceHack(data: never): never;
}['bivarianceHack'];

type FieldsOf<Schema extends SchemaLike, TypeName> =
  TypeOf<Schema, TypeName> extends { fields: infer Fields } ? Fields : {};

type RootTypeName<
  Schema extends SchemaLike,
  Kind extends 'mutation' | 'subscription',
> = Schema extends { [K in Kind]: infer Name } ? Name & string : never;

type GraphCacheInputObjectRec<
  InputFields,
  Schema extends SchemaLike,
  InputObject = {},
> = InputFields extends readonly [infer InputField, ...infer Rest]
  ? GraphCacheInputObjectRec<
      Rest,
      Schema,
      (InputField extends { name: any; type: any }
        ? InputField extends { defaultValue?: undefined | null; type: { kind: 'NON_NULL' } }
          ? {
              [Name in InputField['name']]: GraphCacheInputOfType<InputField['type'], Schema, true>;
            }
          : {
              [Name in InputField['name']]?: GraphCacheInputOfType<
                InputField['type'],
                Schema,
                true
              > | null;
            }
        : {}) &
        InputObject
    >
  : keyof InputObject extends never
    ? Record<string, never>
    : obj<InputObject>;

type GraphCacheInputObjectOneOfRec<
  InputFields,
  Schema extends SchemaLike,
  InputObject = never,
> = InputFields extends readonly [infer InputField, ...infer Rest]
  ? GraphCacheInputObjectOneOfRec<
      Rest,
      Schema,
      | (InputField extends { name: any; type: any }
          ? {
              [Name in InputField['name']]: GraphCacheInputOfType<
                InputField['type'],
                Schema,
                false
              >;
            }
          : never)
      | InputObject
    >
  : InputObject;

type GraphCacheInputOfType<TypeRef, Schema extends SchemaLike, IsOptional> = TypeRef extends {
  kind: 'NON_NULL';
  ofType: any;
}
  ? GraphCacheInputOfType<TypeRef['ofType'], Schema, false>
  : TypeRef extends { kind: 'LIST'; ofType: any }
    ? IsOptional extends false
      ? Array<GraphCacheInputOfType<TypeRef['ofType'], Schema, true>>
      : null | Array<GraphCacheInputOfType<TypeRef['ofType'], Schema, true>>
    : TypeRef extends { name: any }
      ? IsOptional extends false
        ? GraphCacheInputOfNamedType<TypeRef['name'], Schema>
        : null | GraphCacheInputOfNamedType<TypeRef['name'], Schema>
      : unknown;

type GraphCacheInputOfNamedType<
  TypeName,
  Schema extends SchemaLike,
> = TypeName extends keyof TypeMap<Schema>
  ? TypeMap<Schema>[TypeName] extends {
      kind: 'INPUT_OBJECT';
      inputFields: any;
      isOneOf?: any;
    }
    ? TypeMap<Schema>[TypeName]['isOneOf'] extends true
      ? GraphCacheInputObjectOneOfRec<TypeMap<Schema>[TypeName]['inputFields'], Schema>
      : GraphCacheInputObjectRec<TypeMap<Schema>[TypeName]['inputFields'], Schema>
    : GraphCacheScalarOfNamedType<TypeName, Schema>
  : GraphCacheScalar;

// NOTE: Custom scalars without a configured type are `unknown` in gql.tada. Graphcache
// stores them as its own `Scalar` type, and `unknown` isn't assignable to it, which
// would make the config incompatible with `cacheExchange`'s constraint
type GraphCacheScalarOfNamedType<
  TypeName,
  Schema extends SchemaLike,
> = TypeName extends keyof TypeMap<Schema>
  ? TypeMap<Schema>[TypeName] extends { type: any }
    ? unknown extends TypeMap<Schema>[TypeName]['type']
      ? GraphCacheScalar
      : TypeMap<Schema>[TypeName]['type']
    : TypeMap<Schema>[TypeName] extends { enumValues: any }
      ? TypeMap<Schema>[TypeName]['enumValues']
      : GraphCacheScalar
  : GraphCacheScalar;

type GraphCacheArgsOfField<Field, Schema extends SchemaLike> = Field extends {
  args?: infer Args;
}
  ? unknown extends Args
    ? Record<string, never>
    : GraphCacheInputObjectRec<Exclude<Args, undefined>, Schema>
  : Record<string, never>;

type GraphCacheOutputOfType<
  TypeRef,
  Schema extends SchemaLike,
  IsOptional,
  Depth extends readonly unknown[] = GraphCacheDepth,
> = TypeRef extends {
  kind: 'NON_NULL';
  ofType: any;
}
  ? GraphCacheOutputOfType<TypeRef['ofType'], Schema, false, Depth>
  : TypeRef extends { kind: 'LIST'; ofType: any }
    ? IsOptional extends false
      ? Array<GraphCacheOutputOfType<TypeRef['ofType'], Schema, true, Depth>>
      : null | Array<GraphCacheOutputOfType<TypeRef['ofType'], Schema, true, Depth>>
    : TypeRef extends { name: any }
      ? IsOptional extends false
        ? GraphCacheOutputOfNamedType<TypeRef['name'], Schema, Depth>
        : null | GraphCacheOutputOfNamedType<TypeRef['name'], Schema, Depth>
      : unknown;

type GraphCacheOutputOfNamedType<
  TypeName,
  Schema extends SchemaLike,
  Depth extends readonly unknown[] = GraphCacheDepth,
> = TypeName extends keyof TypeMap<Schema>
  ? TypeMap<Schema>[TypeName] extends { kind: 'OBJECT'; fields: any }
    ? GraphCacheObjectOfType<Schema, TypeName, Depth>
    : TypeMap<Schema>[TypeName] extends { kind: 'INTERFACE' | 'UNION'; possibleTypes: any }
      ? GraphCacheObjectOfType<Schema, TypeMap<Schema>[TypeName]['possibleTypes'], Depth>
      : GraphCacheScalarOfNamedType<TypeName, Schema>
  : GraphCacheScalar;

type GraphCacheObjectOfType<
  Schema extends SchemaLike,
  TypeName,
  Depth extends readonly unknown[] = GraphCacheDepth,
> = TypeName extends keyof TypeMap<Schema>
  ? TypeMap<Schema>[TypeName] extends { kind: 'OBJECT'; fields: infer Fields }
    ? Depth extends []
      ? {
          __typename: TypeName;
        }
      : obj<
          {
            __typename: TypeName;
          } & {
            [FieldName in keyof Fields]?: Fields[FieldName] extends { type: infer TypeRef }
              ? GraphCacheOutputOfType<TypeRef, Schema, true, GraphCacheDecrement<Depth>>
              : unknown;
          }
        >
    : never
  : never;

type GraphCacheResolverOutputOfType<
  TypeRef,
  Schema extends SchemaLike,
  IsOptional,
  Depth extends readonly unknown[] = GraphCacheDepth,
> = TypeRef extends {
  kind: 'NON_NULL';
  ofType: any;
}
  ? GraphCacheResolverOutputOfType<TypeRef['ofType'], Schema, false, Depth>
  : TypeRef extends { kind: 'LIST'; ofType: any }
    ? IsOptional extends false
      ? Array<GraphCacheResolverOutputOfType<TypeRef['ofType'], Schema, true, Depth>>
      : null | Array<GraphCacheResolverOutputOfType<TypeRef['ofType'], Schema, true, Depth>>
    : TypeRef extends { name: any }
      ? IsOptional extends false
        ? GraphCacheResolverOutputOfNamedType<TypeRef['name'], Schema, Depth>
        : null | GraphCacheResolverOutputOfNamedType<TypeRef['name'], Schema, Depth>
      : unknown;

type GraphCacheResolverOutputOfNamedType<
  TypeName,
  Schema extends SchemaLike,
  Depth extends readonly unknown[] = GraphCacheDepth,
> = TypeName extends keyof TypeMap<Schema>
  ? TypeMap<Schema>[TypeName] extends { kind: 'OBJECT' | 'INTERFACE' | 'UNION' }
    ? // NOTE: Resolvers may return entity keys, e.g. from `cache.keyOfEntity()`
      GraphCacheOutputOfNamedType<TypeName, Schema, Depth> | string
    : GraphCacheOutputOfNamedType<TypeName, Schema, Depth>
  : GraphCacheScalar;

type GraphCacheNormalize<T> = T extends readonly (infer Item)[]
  ? Array<GraphCacheNormalize<Item>>
  : T extends { __typename: string }
    ? GraphCacheReference<T>
    : T;

type GraphCacheTypedEntity<Schema extends SchemaLike, TypeName extends TypeNames<Schema>> =
  | GraphCacheReference<{ __typename: TypeName }>
  | ({ __typename: TypeName } & { [key: string]: unknown });

type GraphCacheEntityInput<Schema extends SchemaLike> =
  | GraphCacheTypedEntity<Schema, TypeNames<Schema>>
  | GraphCacheEntity;

// NOTE: Blocks inference from a resolver's contextual return type into `resolve()`'s
// type parameters, which otherwise recurses through the whole output type (TS2589)
type noInfer<T> = [T][T extends any ? 0 : never];

type GraphCacheResolveResult<Schema extends SchemaLike, TypeName, FieldName> = FieldsOf<
  Schema,
  TypeName
>[FieldName & keyof FieldsOf<Schema, TypeName>] extends {
  type: infer TypeRef;
}
  ? GraphCacheNormalize<GraphCacheOutputOfType<TypeRef, Schema, true>> | undefined
  : GraphCacheDataField | undefined;

interface GraphCache<Schema extends SchemaLike> {
  keyOfEntity(entity: GraphCacheEntityInput<Schema> | undefined): string | null;
  keyOfField(fieldName: string, args?: GraphCacheFieldArgs): string | null;
  resolve<
    TypeName extends TypeNames<Schema>,
    FieldName extends keyof FieldsOf<Schema, TypeName> & string,
  >(
    entity: GraphCacheTypedEntity<Schema, TypeName> | null | undefined,
    fieldName: FieldName,
    args?: GraphCacheArgsOfField<FieldsOf<Schema, TypeName>[FieldName], Schema>
  ): noInfer<GraphCacheResolveResult<Schema, TypeName, FieldName>>;
  resolve<FieldName extends keyof FieldsOf<Schema, Schema['query']> & string>(
    entity: Schema['query'],
    fieldName: FieldName,
    args?: GraphCacheArgsOfField<FieldsOf<Schema, Schema['query']>[FieldName], Schema>
  ): noInfer<GraphCacheResolveResult<Schema, Schema['query'], FieldName>>;
  resolve(
    entity: string | null | undefined,
    fieldName: string,
    args?: GraphCacheFieldArgs
  ): GraphCacheDataField | undefined;
  inspectFields(entity: GraphCacheEntity): GraphCacheFieldInfo[];
  invalidate(
    entity: GraphCacheEntity | undefined,
    fieldName?: string,
    args?: GraphCacheFieldArgs
  ): void;
  updateQuery<T = GraphCacheData, V = GraphCacheVariables>(
    input: { query: unknown; variables?: V },
    updater: (data: T | null) => T | null
  ): void;
  readQuery<T = GraphCacheData, V = GraphCacheVariables>(input: {
    query: unknown;
    variables?: V;
  }): T | null;
  readFragment<T = GraphCacheData, V = GraphCacheVariables>(
    fragment: unknown,
    entity: string | GraphCacheData | T,
    variables?: V
  ): T | null;
  writeFragment<T = GraphCacheData, V = GraphCacheVariables>(
    fragment: unknown,
    data: T,
    variables?: V
  ): void;
  link(
    entity: GraphCacheEntity,
    field: string,
    args: GraphCacheFieldArgs,
    link: GraphCacheLink<GraphCacheEntity>
  ): void;
  link(entity: GraphCacheEntity, field: string, value: GraphCacheLink<GraphCacheEntity>): void;
}

type GraphCacheResolverResult =
  | GraphCacheDataField
  | (GraphCacheDataFields & { __typename?: string })
  | null
  | undefined;

type GraphCacheResolver<
  Schema extends SchemaLike,
  ParentData = GraphCacheDataFields,
  Args = GraphCacheVariables,
  Result = GraphCacheResolverResult,
> = {
  bivarianceHack(
    parent: ParentData,
    args: Args,
    cache: GraphCache<Schema>,
    info: GraphCacheResolveInfo
  ): Result;
}['bivarianceHack'];

type GraphCacheUpdateResolver<
  Schema extends SchemaLike,
  ParentData = GraphCacheDataFields,
  Args = GraphCacheVariables,
> = {
  bivarianceHack(
    parent: ParentData,
    args: Args,
    cache: GraphCache<Schema>,
    info: GraphCacheResolveInfo
  ): void;
}['bivarianceHack'];

type GraphCacheMakeFunctional<T> = T extends { __typename: string }
  ? obj<
      {
        [P in keyof T]?: GraphCacheMakeFunctional<T[P]>;
      } & {
        __typename: T['__typename'];
      }
    >
  : GraphCacheNestedOptimisticResolver<T> | T;

type GraphCacheNestedOptimisticResolver<Result> = {
  bivarianceHack(
    args: GraphCacheVariables,
    cache: GraphCache<any>,
    info: GraphCacheResolveInfo
  ): Result;
}['bivarianceHack'];

type GraphCacheOptimisticMutationResolver<
  Schema extends SchemaLike,
  Args = GraphCacheVariables,
  Result = GraphCacheLink<GraphCacheData> | GraphCacheScalar,
> = {
  bivarianceHack(
    args: Args,
    cache: GraphCache<Schema>,
    info: GraphCacheResolveInfo
  ): GraphCacheMakeFunctional<Result>;
}['bivarianceHack'];

type GraphCacheKeysConfig<Schema extends SchemaLike> = {
  [TypeName in TypeNames<Schema>]?: ifObjectType<
    Schema,
    TypeName,
    {
      bivarianceHack(data: GraphCacheObjectOfType<Schema, TypeName>): string | null;
    }['bivarianceHack'],
    GraphCacheInvalidKeyGenerator
  >;
};

type GraphCacheResolversConfig<Schema extends SchemaLike> = {
  [TypeName in TypeNames<Schema>]?: ifObjectType<
    Schema,
    TypeName,
    {
      [FieldName in keyof FieldsOf<Schema, TypeName>]?: FieldsOf<
        Schema,
        TypeName
      >[FieldName] extends {
        type: infer TypeRef;
      }
        ? GraphCacheResolver<
            Schema,
            GraphCacheObjectOfType<Schema, TypeName>,
            GraphCacheArgsOfField<FieldsOf<Schema, TypeName>[FieldName], Schema>,
            GraphCacheResolverOutputOfType<TypeRef, Schema, true> | undefined
          >
        : GraphCacheResolver<Schema>;
    }
  >;
};

type RootTypeNames<Schema extends SchemaLike> =
  | Schema['query']
  | Schema['mutation']
  | Schema['subscription'];

// NOTE: Graphcache calls updaters for fields on any type. On root types, the parent
// is the operation's result data, otherwise it's the entity's data that's being written
type GraphCacheUpdaterParent<
  Schema extends SchemaLike,
  TypeName,
  FieldName extends PropertyKey,
  TypeRef,
> =
  TypeName extends RootTypeNames<Schema>
    ? { [Name in FieldName]: GraphCacheOutputOfType<TypeRef, Schema, true> }
    : obj<
        Omit<GraphCacheObjectOfType<Schema, TypeName>, FieldName> & {
          [Name in FieldName]: GraphCacheOutputOfType<TypeRef, Schema, true>;
        }
      >;

type GraphCacheUpdatesConfig<Schema extends SchemaLike> = {
  [TypeName in TypeNames<Schema>]?: ifObjectType<
    Schema,
    TypeName,
    {
      [FieldName in keyof FieldsOf<Schema, TypeName>]?: FieldsOf<
        Schema,
        TypeName
      >[FieldName] extends {
        type: infer TypeRef;
      }
        ? GraphCacheUpdateResolver<
            Schema,
            GraphCacheUpdaterParent<Schema, TypeName, FieldName, TypeRef>,
            GraphCacheArgsOfField<FieldsOf<Schema, TypeName>[FieldName], Schema>
          >
        : GraphCacheUpdateResolver<Schema>;
    }
  >;
};

type GraphCacheOptimisticMutationConfig<Schema extends SchemaLike> =
  RootTypeName<Schema, 'mutation'> extends infer MutationName extends string
    ? {
        [FieldName in keyof FieldsOf<Schema, MutationName>]?: FieldsOf<
          Schema,
          MutationName
        >[FieldName] extends { type: infer TypeRef }
          ? GraphCacheOptimisticMutationResolver<
              Schema,
              GraphCacheArgsOfField<FieldsOf<Schema, MutationName>[FieldName], Schema>,
              GraphCacheOutputOfType<TypeRef, Schema, true>
            >
          : GraphCacheOptimisticMutationResolver<Schema>;
      }
    : {};

type GraphCacheExchangeOptions<Schema extends SchemaLike> = {
  logger?: (severity: 'debug' | 'error' | 'warn', message: string) => void;
  directives?: Record<
    string,
    (directiveArguments: Record<string, unknown> | null) => GraphCacheResolver<Schema>
  >;
  globalIDs?: string[] | boolean;
  possibleTypes?: Record<string, string[]>;
  schema?: any;
  storage?: any;
};

export type GraphCacheReference<T = unknown> = string & {
  readonly [graphCacheReference]?: T;
};

export type GraphCacheObject<
  Tada extends GraphQLTadaAPI<any, any> | SchemaLike,
  TypeName extends string,
> = GraphCacheObjectOfType<SchemaOf<Tada>, TypeName>;

export type GraphCacheFieldValue<
  Tada extends GraphQLTadaAPI<any, any> | SchemaLike,
  TypeName extends string,
  FieldName extends string,
> = FieldName extends keyof FieldsOf<SchemaOf<Tada>, TypeName>
  ? FieldsOf<SchemaOf<Tada>, TypeName>[FieldName] extends { type: infer TypeRef }
    ? GraphCacheOutputOfType<TypeRef, SchemaOf<Tada>, true>
    : never
  : never;

export type GraphCacheFieldArgsOf<
  Tada extends GraphQLTadaAPI<any, any> | SchemaLike,
  TypeName extends string,
  FieldName extends string,
> = FieldName extends keyof FieldsOf<SchemaOf<Tada>, TypeName>
  ? GraphCacheArgsOfField<FieldsOf<SchemaOf<Tada>, TypeName>[FieldName], SchemaOf<Tada>>
  : never;

export type GraphCacheConfig<Tada extends GraphQLTadaAPI<any, any> | SchemaLike> =
  GraphCacheExchangeOptions<SchemaOf<Tada>> & {
    keys?: GraphCacheKeysConfig<SchemaOf<Tada>>;
    resolvers?: GraphCacheResolversConfig<SchemaOf<Tada>>;
    updates?: GraphCacheUpdatesConfig<SchemaOf<Tada>>;
    optimistic?: GraphCacheOptimisticMutationConfig<SchemaOf<Tada>>;
  };
