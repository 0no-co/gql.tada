import type { obj } from './utils';

/** Format of introspection data queryied from your schema.
 *
 * @remarks
 * You must provide your introspected schema in the standard introspection
 * format (as represented by this type) to `setupSchema` to configure this
 * library to use your types.
 *
 * @see {@link setupSchema} for where to use this data.
 */
export interface IntrospectionQuery {
  readonly __schema: IntrospectionSchema;
}

interface IntrospectionSchema {
  readonly queryType: IntrospectionNamedTypeRef;
  readonly mutationType?: IntrospectionNamedTypeRef | null;
  readonly subscriptionType?: IntrospectionNamedTypeRef | null;
  /* Usually this would be:
    | IntrospectionScalarType
    | IntrospectionObjectType
    | IntrospectionInterfaceType
    | IntrospectionUnionType
    | IntrospectionEnumType
    | IntrospectionInputObjectType;
    However, this forces TypeScript to evaluate the type of an
    entire introspection query, rather than accept its shape as-is.
    So, instead, we constrain it to `any` here.
  */
  readonly types: readonly any[];
}

interface IntrospectionScalarType {
  readonly kind: 'SCALAR';
  readonly name: string;
  readonly specifiedByURL?: string | null;
}

export interface IntrospectionObjectType {
  readonly kind: 'OBJECT';
  readonly name: string;
  // Usually this would be `IntrospectionField`.
  // However, to save TypeScript some work, instead, we constraint it to `any` here.
  readonly fields: readonly any[];
  // The `interfaces` field isn't used. It's omitted here
}

interface IntrospectionInterfaceType {
  readonly kind: 'INTERFACE';
  readonly name: string;
  // Usually this would be `IntrospectionField`.
  // However, to save TypeScript some work, instead, we constraint it to `any` here.
  readonly fields: readonly any[];
  readonly possibleTypes: readonly IntrospectionNamedTypeRef[];
  // The `interfaces` field isn't used. It's omitted here
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
  readonly type: IntrospectionTypeRef;
  // The `args` field isn't used. It's omitted here
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

type mapScalar<
  Type extends IntrospectionScalarType,
  Scalars extends ScalarsLike = DefaultScalars,
> = {
  kind: 'SCALAR';
  name: Type['name'];
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

type mapField<T> = T extends IntrospectionField
  ? {
      name: T['name'];
      type: T['type'];
    }
  : never;

export type mapObject<T extends IntrospectionObjectType> = {
  kind: 'OBJECT';
  name: T['name'];
  fields: obj<{
    [P in T['fields'][number]['name']]: T['fields'][number] extends infer Field
      ? Field extends { readonly name: P }
        ? mapField<Field>
        : never
      : never;
  }>;
};

export type mapInputObject<T extends IntrospectionInputObjectType> = {
  kind: 'INPUT_OBJECT';
  name: T['name'];
  inputFields: [...T['inputFields']];
};

type mapInterface<T extends IntrospectionInterfaceType> = {
  kind: 'INTERFACE';
  name: T['name'];
  possibleTypes: T['possibleTypes'][number]['name'];
  fields: obj<{
    [P in T['fields'][number]['name']]: T['fields'][number] extends infer Field
      ? Field extends { readonly name: P }
        ? mapField<Field>
        : never
      : never;
  }>;
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

type getScalarType<
  Schema extends IntrospectionLikeType,
  Name extends string,
> = Schema['types'][Name] extends { kind: 'SCALAR'; type: infer Type }
  ? Type
  : Schema['types'][Name] extends { kind: 'ENUM'; type: infer Type }
    ? Type
    : never;

export type ScalarsLike = {
  [name: string]: any;
};

export type IntrospectionLikeType = {
  query: string;
  mutation?: any;
  subscription?: any;
  types: { [name: string]: any };
};

export type { mapIntrospectionTypes, mapIntrospection, getScalarType };
