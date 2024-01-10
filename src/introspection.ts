import type { obj } from './utils';

interface IntrospectionQuery {
  readonly __schema: IntrospectionSchema;
}

interface IntrospectionSchema {
  readonly queryType: IntrospectionNamedTypeRef;
  readonly mutationType?: IntrospectionNamedTypeRef | null;
  readonly subscriptionType?: IntrospectionNamedTypeRef | null;
  readonly types: readonly IntrospectionType[];
}

export type IntrospectionType =
  | IntrospectionScalarType
  | IntrospectionObjectType
  | IntrospectionInterfaceType
  | IntrospectionUnionType
  | IntrospectionEnumType
  | IntrospectionInputObjectType;

interface IntrospectionScalarType {
  readonly kind: 'SCALAR';
  readonly name: string;
  readonly specifiedByURL?: string | null;
}

export interface IntrospectionObjectType {
  readonly kind: 'OBJECT';
  readonly name: string;
  readonly fields: readonly IntrospectionField[];
  readonly interfaces: readonly IntrospectionNamedTypeRef[] | never;
}

interface IntrospectionInterfaceType {
  readonly kind: 'INTERFACE';
  readonly name: string;
  readonly fields: readonly IntrospectionField[];
  readonly possibleTypes: readonly IntrospectionNamedTypeRef[];
  readonly interfaces?: readonly IntrospectionNamedTypeRef[] | null;
}

interface IntrospectionUnionType {
  readonly kind: 'UNION';
  readonly name: string;
  readonly possibleTypes: readonly IntrospectionNamedTypeRef[];
}

interface IntrospectionEnumValue {
  readonly name: string;
}

interface IntrospectionEnumType {
  readonly kind: 'ENUM';
  readonly name: string;
  readonly enumValues: readonly IntrospectionEnumValue[];
}

interface IntrospectionInputObjectType {
  readonly kind: 'INPUT_OBJECT';
  readonly name: string;
  readonly inputFields: readonly IntrospectionInputValue[];
}

export interface IntrospectionListTypeRef {
  readonly kind: 'LIST';
  readonly ofType: IntrospectionTypeRef;
}

export interface IntrospectionNonNullTypeRef {
  readonly kind: 'NON_NULL';
  readonly ofType: IntrospectionTypeRef;
}

export type IntrospectionTypeRef =
  | IntrospectionNamedTypeRef
  | IntrospectionListTypeRef
  | IntrospectionNonNullTypeRef;

export interface IntrospectionNamedTypeRef {
  readonly name: string;
}

export interface IntrospectionField {
  readonly name: string;
  readonly args: readonly IntrospectionInputValue[];
  readonly type: IntrospectionTypeRef;
}

interface IntrospectionInputValue {
  readonly name: string;
  readonly type: IntrospectionTypeRef;
  readonly defaultValue?: string | null;
}

interface DefaultScalars {
  ID: number | string;
  Boolean: boolean;
  String: string;
  Float: number;
  Int: number;
}

type mapNames<T extends readonly any[]> = obj<{
  [P in T[number]['name']]: T[number] extends infer Value
    ? Value extends { readonly name: P }
      ? obj<Value>
      : never
    : never;
}>;

type mapScalar<
  Type extends IntrospectionScalarType,
  Scalars extends ScalarsLike = DefaultScalars,
> = {
  kind: 'SCALAR';
  type: Type['name'] extends keyof Scalars
    ? Scalars[Type['name']]
    : Type['name'] extends keyof DefaultScalars
      ? DefaultScalars[Type['name']]
      : unknown;
};

type mapEnum<T extends IntrospectionEnumType> = {
  kind: 'ENUM';
  name: T['name'];
  type: T['enumValues'][number]['name'];
};

export type mapObject<T extends IntrospectionObjectType> = {
  kind: 'OBJECT';
  name: T['name'];
  interfaces: T['interfaces'][number]['name'];
  fields: obj<mapNames<T['fields']>>;
};

export type mapInputObject<T extends IntrospectionInputObjectType> = {
  kind: 'INPUT_OBJECT';
  name: T['name'];
  inputFields: [...T['inputFields']];
};

type mapInterface<T extends IntrospectionInterfaceType> = {
  kind: 'INTERFACE';
  name: T['name'];
  interfaces: T['interfaces'] extends readonly any[] ? T['interfaces'][number]['name'] : never;
  possibleTypes: T['possibleTypes'][number]['name'];
  fields: obj<mapNames<T['fields']>>;
};

type mapUnion<T extends IntrospectionUnionType> = {
  kind: 'UNION';
  name: T['name'];
  fields: {};
  possibleTypes: T['possibleTypes'][number]['name'];
};

type mapType<
  Type,
  Scalars extends ScalarsLike = DefaultScalars,
> = Type extends IntrospectionScalarType
  ? mapScalar<Type, Scalars>
  : Type extends IntrospectionEnumType
    ? mapEnum<Type>
    : Type extends IntrospectionObjectType
      ? mapObject<Type>
      : Type extends IntrospectionInterfaceType
        ? mapInterface<Type>
        : Type extends IntrospectionUnionType
          ? mapUnion<Type>
          : Type extends IntrospectionInputObjectType
            ? mapInputObject<Type>
            : never;

type mapIntrospectionTypes<
  Query extends IntrospectionQuery,
  Scalars extends ScalarsLike = DefaultScalars,
> = obj<{
  [P in Query['__schema']['types'][number]['name']]: Query['__schema']['types'][number] extends infer Type
    ? Type extends { readonly name: P }
      ? mapType<Type, Scalars>
      : never
    : never;
}>;

type mapIntrospection<
  Query extends IntrospectionQuery,
  Scalars extends ScalarsLike = DefaultScalars,
> = {
  query: Query['__schema']['queryType']['name'];
  mutation: Query['__schema']['mutationType'] extends { name: string }
    ? Query['__schema']['mutationType']['name']
    : never;
  subscription: Query['__schema']['subscriptionType'] extends { name: string }
    ? Query['__schema']['subscriptionType']['name']
    : never;
  types: mapIntrospectionTypes<Query, Scalars>;
};

export type ScalarsLike = {
  [name: string]: any;
};

export type IntrospectionLikeType = {
  query: string;
  mutation: string | never;
  subscription: string | never;
  types: { [name: string]: any };
};

export type { mapIntrospectionTypes, mapIntrospection };
