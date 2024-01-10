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

type mapNames<T extends readonly any[]> = obj<{
  [P in T[number]['name']]: T[number] extends infer Value
    ? Value extends { readonly name: P }
      ? obj<Value>
      : never
    : never;
}>;

type mapScalar<T extends IntrospectionScalarType> = {
  kind: 'SCALAR';
  type: T['name'] extends 'Int'
    ? number
    : T['name'] extends 'Float'
      ? number
      : T['name'] extends 'String'
        ? string
        : T['name'] extends 'Boolean'
          ? boolean
          : T['name'] extends 'ID'
            ? number | string
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

type mapType<T> = T extends IntrospectionScalarType
  ? mapScalar<T>
  : T extends IntrospectionEnumType
    ? mapEnum<T>
    : T extends IntrospectionObjectType
      ? mapObject<T>
      : T extends IntrospectionInterfaceType
        ? mapInterface<T>
        : T extends IntrospectionUnionType
          ? mapUnion<T>
          : T extends IntrospectionInputObjectType
            ? mapInputObject<T>
            : never;

type mapIntrospectionTypes<T extends IntrospectionQuery> = obj<{
  [P in T['__schema']['types'][number]['name']]: T['__schema']['types'][number] extends infer Type
    ? Type extends { readonly name: P }
      ? mapType<Type>
      : never
    : never;
}>;

type mapIntrospection<T extends IntrospectionQuery> = {
  query: T['__schema']['queryType']['name'];
  mutation: T['__schema']['mutationType'] extends { name: string }
    ? T['__schema']['mutationType']['name']
    : never;
  subscription: T['__schema']['subscriptionType'] extends { name: string }
    ? T['__schema']['subscriptionType']['name']
    : never;
  types: mapIntrospectionTypes<T>;
};

export type IntrospectionLikeType = {
  query: string;
  mutation: string | never;
  subscription: string | never;
  types: { [name: string]: any };
};

export type { mapIntrospectionTypes, mapIntrospection };
