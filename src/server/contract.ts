/** The gql.tada schema contract.
 *
 * @remarks
 * These types describe the schema format that `gql.tada` understands when a schema is passed
 * as a type rather than as introspection data. Schema builders (such as the one exported by
 * `gql.tada/server`, Pothos, Grats, etc.) can emit this format to give clients typed GraphQL
 * documents with no code generation step.
 *
 * A builder either:
 * - exposes a {@link TadaSchema} type directly (e.g. via code generation), or;
 * - attaches it to its runtime schema object as a type-only property with {@link TadaSchemaCarrier}
 *   so that users can extract it with {@link IntrospectionOf}.
 *
 * The helper types below construct each part of the format. Builders should only use these
 * helpers rather than writing the underlying object types by hand, since the helpers are the
 * stable, versioned surface of this contract.
 *
 * @example
 * ```ts
 * import type { TadaSchema, TadaObjectType, TadaNamedTypeRef, TadaNonNullTypeRef } from 'gql.tada/server';
 *
 * type schema = TadaSchema<{
 *   query: 'Query';
 *   types:
 *     | TadaObjectType<'Query', { hello: TadaNonNullTypeRef<TadaNamedTypeRef<'SCALAR', 'String'>> }>;
 * }>;
 * ```
 *
 * @packageDocumentation
 */

/** Kinds of named GraphQL types. */
export type TadaNamedKind = 'SCALAR' | 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT';

/** A reference to a named type. */
export interface TadaNamedTypeRef<
  Kind extends TadaNamedKind = TadaNamedKind,
  Name extends string = string,
> {
  readonly kind: Kind;
  readonly name: Name;
  readonly ofType: null;
}

/** A Non-Null wrapping type. Non-Null types may not wrap other Non-Null types. */
export interface TadaNonNullTypeRef<
  OfType extends TadaNamedTypeRef | TadaListTypeRef = TadaNamedTypeRef | TadaListTypeRef<any>,
> {
  readonly kind: 'NON_NULL';
  readonly name: never;
  readonly ofType: OfType;
}

/** A List wrapping type. */
export interface TadaListTypeRef<OfType extends TadaTypeRef = TadaTypeRef> {
  readonly kind: 'LIST';
  readonly name: never;
  readonly ofType: OfType;
}

/** Any type reference, as used by fields and input fields. */
export type TadaTypeRef = TadaNamedTypeRef | TadaNonNullTypeRef | TadaListTypeRef<any>;

/** A custom scalar type.
 * @param Type - The TypeScript type of the scalar as it's sent over the wire (i.e. its serialized form).
 */
export type TadaScalarType<Name extends string, Type> = {
  kind: 'SCALAR';
  name: Name;
  type: Type;
};

/** An enum type.
 * @param Values - A union of the enum's value names.
 */
export type TadaEnumType<Name extends string, Values extends string> = {
  kind: 'ENUM';
  name: Name;
  enumValues: Values;
};

type fieldsOf<Fields> = {
  -readonly [FieldName in keyof Fields]-?: {
    name: FieldName;
    type: Exclude<Fields[FieldName], undefined>;
  };
};

/** An object type.
 * @param Fields - An object of field names to type references.
 */
export type TadaObjectType<Name extends string, Fields extends { [name: string]: TadaTypeRef }> = {
  kind: 'OBJECT';
  name: Name;
  fields: fieldsOf<Fields>;
};

/** An interface type.
 * @param Fields - An object of field names to type references.
 * @param PossibleTypes - A union of the names of all object types implementing this interface.
 */
export type TadaInterfaceType<
  Name extends string,
  Fields extends { [name: string]: TadaTypeRef },
  PossibleTypes extends string = never,
> = {
  kind: 'INTERFACE';
  name: Name;
  fields: fieldsOf<Fields>;
  possibleTypes: PossibleTypes;
};

/** A union type.
 * @param PossibleTypes - A union of the names of the union's member object types.
 */
export type TadaUnionType<Name extends string, PossibleTypes extends string> = {
  kind: 'UNION';
  name: Name;
  fields: {};
  possibleTypes: PossibleTypes;
};

/** An input object type.
 * @param Fields - An object of input field names to type references.
 * @param DefaultedFields - A union of the input field names that have a default value.
 * @param IsOneOf - Whether the input object is a OneOf Input Object.
 */
export type TadaInputObjectType<
  Name extends string,
  Fields extends { [name: string]: TadaTypeRef },
  DefaultedFields extends keyof Fields = never,
  IsOneOf extends boolean = false,
> = {
  kind: 'INPUT_OBJECT';
  name: Name;
  isOneOf: IsOneOf;
  inputFields: {
    -readonly [FieldName in keyof Fields]-?: {
      name: FieldName;
      type: Exclude<Fields[FieldName], undefined>;
      defaultValue: FieldName extends DefaultedFields ? {} : null;
    };
  };
};

/** Any named type of the contract. */
export type TadaType =
  | { kind: 'SCALAR'; name: string; type: unknown }
  | { kind: 'ENUM'; name: string; enumValues: string }
  | { kind: 'OBJECT'; name: string; fields: { [name: string]: any } }
  | { kind: 'INTERFACE'; name: string; fields: { [name: string]: any }; possibleTypes: string }
  | { kind: 'UNION'; name: string; fields: {}; possibleTypes: string }
  | { kind: 'INPUT_OBJECT'; name: string; isOneOf: boolean; inputFields: { [name: string]: any } };

/** Definition of a schema, passed to {@link TadaSchema}. */
export interface TadaSchemaDefinition {
  /** Identifies the schema in gql.tada's multi-schema mode. */
  name?: string;
  query: string;
  mutation?: string;
  subscription?: string;
  /** A union of all named types of the schema, except built-in scalars. */
  types: TadaType;
}

/** Builds the schema type that `gql.tada`'s `initGraphQLTada` accepts as `introspection`. */
export type TadaSchema<Definition extends TadaSchemaDefinition> = {
  name: Definition extends { name: infer Name extends string } ? Name : never;
  query: Definition['query'];
  mutation: Definition extends { mutation: infer Name extends string } ? Name : never;
  subscription: Definition extends { subscription: infer Name extends string } ? Name : never;
  types: { [Type in Definition['types'] as Type['name']]: Type };
};

/** Version of the {@link TadaSchemaCarrier} convention. */
export type TadaContractVersion = 1;

/** Attaches a {@link TadaSchema} type to a runtime schema object.
 *
 * @remarks
 * The `~tada` property is type-only and never set at runtime. Builders intersect their runtime
 * schema type (e.g. `GraphQLSchema`) with this interface, which lets users retrieve the schema
 * type with {@link IntrospectionOf}.
 */
export interface TadaSchemaCarrier<Schema = unknown> {
  readonly '~tada'?: {
    readonly version: TadaContractVersion;
    readonly schema: Schema;
  };
}

/** Extracts the schema type from a schema object carrying the gql.tada contract.
 *
 * @remarks
 * Passing a schema that doesn't carry a schema type (e.g. one typed as a plain `GraphQLSchema`)
 * is a type error, rather than silently resolving to `never`.
 *
 * @example
 * ```ts
 * import { initGraphQLTada } from 'gql.tada';
 * import type { IntrospectionOf } from 'gql.tada';
 * import type { schema } from './server/schema';
 *
 * export const graphql = initGraphQLTada<{
 *   introspection: IntrospectionOf<typeof schema>;
 * }>();
 * ```
 */
export type IntrospectionOf<T extends TadaSchemaCarrier<unknown>> =
  NonNullable<T['~tada']> extends { readonly schema: infer Schema } ? Schema : never;
