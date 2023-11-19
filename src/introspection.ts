import type { Obj } from './utils';

export interface IntrospectionQuery {
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

type _nameMapContinue<T extends readonly any[]> = (T[0] extends { name: string }
  ? { [P in T[0]['name']]: T[0] }
  : {}) &
  (T extends readonly []
    ? {}
    : T extends readonly [infer _Head, ...infer Tail]
    ? _nameMapContinue<Tail>
    : {});

type _nameValuesContinue<T extends readonly any[]> =
  | (T[0] extends { name: infer Name } ? Name : never)
  | (T extends readonly []
      ? never
      : T extends readonly [infer _Head, ...infer Tail]
      ? _nameValuesContinue<Tail>
      : never);

type _literalValuesContinue<T extends readonly any[]> =
  | (T[0] extends { readonly name: infer Name } ? Name : never)
  | (T extends readonly []
      ? never
      : T extends readonly [infer _Head, ...infer Tail]
      ? _nameValuesContinue<Tail>
      : never);

type _scalarMap<T extends IntrospectionScalarType> = {
  kind: 'SCALAR';
  type: T['name'] extends infer Name
    ? Name extends 'Int'
      ? number
      : Name extends 'Float'
      ? number
      : Name extends 'String'
      ? string
      : Name extends 'Boolean'
      ? boolean
      : Name extends 'ID'
      ? number | string
      : unknown
    : unknown;
};

type _enumMap<T extends IntrospectionEnumType> = {
  kind: 'ENUM';
  type: _literalValuesContinue<T['enumValues']>;
};

export type _objectMap<T extends IntrospectionObjectType> = {
  kind: 'OBJECT';
  name: T['name'];
  interfaces: _nameValuesContinue<T['interfaces']>;
  fields: Obj<_nameMapContinue<T['fields']>>;
};

export type _inputObjectMap<T extends IntrospectionInputObjectType> = {
  kind: 'INPUT_OBJECT';
  name: T['name'];
  inputFields: _nameMapContinue<T['inputFields']>;
};

type _interfaceMap<T extends IntrospectionInterfaceType> = {
  kind: 'INTERFACE';
  interfaces: T['interfaces'] extends readonly any[] ? _nameValuesContinue<T['interfaces']> : never;
  possibleTypes: _nameValuesContinue<T['possibleTypes']>;
  fields: Obj<_nameMapContinue<T['fields']>>;
};

type _unionMap<T extends IntrospectionUnionType> = {
  kind: 'UNION';
  fields: {};
  possibleTypes: _nameValuesContinue<T['possibleTypes']>;
};

type _typeMap<T> = T extends IntrospectionScalarType
  ? _scalarMap<T>
  : T extends IntrospectionEnumType
  ? _enumMap<T>
  : T extends IntrospectionObjectType
  ? _objectMap<T>
  : T extends IntrospectionInterfaceType
  ? _interfaceMap<T>
  : T extends IntrospectionUnionType
  ? _unionMap<T>
  : T extends IntrospectionInputObjectType
  ? _inputObjectMap<T>
  : never;

type _introspectionTypesMap<T extends IntrospectionQuery> = _nameMapContinue<
  T['__schema']['types']
> extends infer TypeMap
  ? Obj<{
      [P in keyof TypeMap]: Obj<_typeMap<TypeMap[P]>>;
    }>
  : {};

type _introspectionMap<T extends IntrospectionQuery> = {
  query: T['__schema']['queryType']['name'];
  mutation: T['__schema']['mutationType'] extends { name: string }
    ? T['__schema']['mutationType']['name']
    : never;
  subscription: T['__schema']['subscriptionType'] extends { name: string }
    ? T['__schema']['subscriptionType']['name']
    : never;
  types: _introspectionTypesMap<T>;
};

export type { _introspectionTypesMap as IntrospectionTypes, _introspectionMap as Introspection };
