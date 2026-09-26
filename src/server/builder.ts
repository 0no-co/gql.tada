import type { GraphQLResolveInfo, GraphQLSchema, ValueNode } from 'graphql';

import type { obj } from '../utils';
import type {
  TadaSchema,
  TadaSchemaCarrier,
  TadaObjectType,
  TadaInterfaceType,
  TadaUnionType,
  TadaEnumType,
  TadaScalarType,
  TadaInputObjectType,
  TadaTypeRef,
} from './contract';

import type {
  AppliedDirective,
  BuiltinScalarName,
  DirectiveDefinition,
  DirectiveLocationName,
  InputShape,
  InputValuesInput,
  InputValuesRequest,
  InputValuesShape,
  MaybePromise,
  NamedRef,
  OutputRef,
  OutputShape,
  checkInputValues,
  defaultedInputValues,
  inputValueType,
  inputValuesNamedTypes,
  namedTypeOf,
  toTadaInputFields,
  toTadaTypeRef,
} from './refs';

import { ID, String, Int, Float, Boolean, nonNull, list } from './refs';
import { buildSchema } from './build';

type Extensions = { readonly [key: string]: unknown };

type unionToIntersection<T> = (T extends any ? (x: T) => void : never) extends (
  x: infer Intersection
) => void
  ? Intersection
  : never;

/** A type definition, which is also usable as a reference to its type.
 * @internal
 */
export interface TypeDefinition<
  Kind extends NamedRef['kind'] = NamedRef['kind'],
  Name extends string = string,
  Shape = any,
  Input = any,
  Fragment = unknown,
  References = unknown,
> extends NamedRef<Kind, Name, Shape, Input> {
  /** @internal */
  readonly '~config': unknown;
  /** @internal Type-only. This definition's part of the gql.tada contract. */
  readonly '~fragment'?: Fragment;
  /** @internal Type-only. Names of the types this definition references. */
  readonly '~references'?: References;
}

type AnyTypeDefinition = TypeDefinition<any, string, any, any, any, any>;

/** Only references may be extended, since a definition's type is fixed when it's created
 * @remarks
 * Definitions carry a `~config` property, which references don't have.
 */
type RefOnly = { readonly '~config'?: never };

type isAny<T> = 0 extends 1 & T ? true : false;

/** A resolver function. */
export type Resolver<Source, Context, Args, Result> = (
  source: Source,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo
) => MaybePromise<Result>;

/** A field definition, as returned by `f.field()`. */
export interface FieldDefinition<
  Type extends OutputRef = OutputRef,
  Args = any,
  HasResolver extends boolean = boolean,
  Payload = any,
> {
  readonly type: Type;
  readonly args?: Args;
  /** @internal Type-only */
  readonly '~resolved'?: HasResolver;
  /** @internal Type-only */
  readonly '~payload'?: Payload;
}

interface FieldOptions<Args> {
  args?: Args & checkInputValues<Args, 'ARGUMENT_DEFINITION'>;
  description?: string;
  /** Marks the field as deprecated. */
  deprecationReason?: string;
  directives?: readonly AppliedDirective<'FIELD_DEFINITION'>[];
  extensions?: Extensions;
}

/** Builds fields of object types. Passed to `fields` of `t.object()`. */
export interface FieldBuilder<Parent, Context> {
  /** Defines a field.
   *
   * @remarks
   * When no `resolve` function is passed, the field resolves to the property of the
   * same name on the parent value, which is checked against the object's backing type.
   *
   * For subscription root fields, pass `subscribe` returning an `AsyncIterable` source
   * stream. Each event is then passed to `resolve` as its source value.
   */
  field<const Type extends OutputRef, const Args extends InputValuesInput = {}, Payload = never>(
    config: FieldOptions<Args> & {
      type: Type;
      subscribe?: Resolver<Parent, Context, InputValuesShape<Args>, AsyncIterable<Payload>>;
      resolve: Resolver<
        [Payload] extends [never] ? Parent : Payload,
        Context,
        InputValuesShape<Args>,
        OutputShape<Type>
      >;
    }
  ): FieldDefinition<Type, Args, true, Payload>;
  field<const Type extends OutputRef, const Args extends InputValuesInput = {}, Payload = never>(
    config: FieldOptions<Args> & {
      type: Type;
      subscribe?: Resolver<Parent, Context, InputValuesShape<Args>, AsyncIterable<Payload>>;
      resolve?: undefined;
    }
  ): FieldDefinition<Type, Args, false, Payload>;
}

/** Builds fields of interface types. Passed to `fields` of `t.interface()`. */
export interface InterfaceFieldBuilder {
  /** Defines a field. Interface fields are resolved by the object types that implement them. */
  field<const Type extends OutputRef, const Args extends InputValuesInput = {}>(
    config: FieldOptions<Args> & { type: Type }
  ): FieldDefinition<Type, Args, true, never>;
}

type toTadaFields<Fields> = {
  [Name in keyof Fields & string]: Fields[Name] extends FieldDefinition<infer Type, any, any, any>
    ? toTadaTypeRef<Type>
    : never;
};

type fieldsNamedTypes<Fields> = {
  [Name in keyof Fields]: Fields[Name] extends FieldDefinition<infer Type, infer Args, any, any>
    ? namedTypeOf<Type> | inputValuesNamedTypes<Args>
    : never;
}[keyof Fields];

/** Whether the default resolver can resolve a field from its source value
 * @remarks
 * The default resolver reads the property of the field's name and calls it with `(args, context, info)`
 * if it's a function. A source of `unknown` (e.g. a reference without a backing type) can't be
 * checked, so its fields must have resolvers, unless the source is explicitly `any`.
 */
type canResolveByDefault<Source, Key, Type, Args, Context> =
  isAny<Source> extends true
    ? true
    : Key extends keyof Source
      ? Source[Key] extends MaybePromise<OutputShape<Type>>
        ? true
        : Source[Key] extends (...args: infer Params) => MaybePromise<OutputShape<Type>>
          ? Params extends []
            ? true
            : isAny<Args> extends true
              ? true
              : InputValuesShape<Args> extends Params[0]
                ? Params['length'] extends 0 | 1
                  ? true
                  : Context extends Params[1]
                    ? true
                    : false
                : false
          : false
      : false;

type unresolvableFields<Shape, Fields, Context> = {
  [Name in keyof Fields & string]: isAny<Fields[Name]> extends true
    ? never
    : Fields[Name] extends FieldDefinition<infer Type, infer Args, false, infer Payload>
      ? canResolveByDefault<
          [Payload] extends [never] ? Shape : Payload,
          Name,
          Type,
          Args,
          Context
        > extends true
        ? never
        : Name
      : never;
}[keyof Fields & string];

type checkFieldResolvers<TypeName extends string, Shape, Fields, Context> = [
  unresolvableFields<Shape, Fields, Context>,
] extends [never]
  ? unknown
  : {
      '~error': `Fields of "${TypeName}" without a resolver must match a property on its backing type: ${unresolvableFields<
        Shape,
        Fields,
        Context
      >}`;
    };

// NOTE: Definitions only carry types derived from their configuration (not the configuration's
// types themselves), which keeps them (and emitted declarations) small when they reference each other

/** An object type definition, as returned by `t.object()`. */
export type ObjectDefinition<
  Name extends string,
  Shape,
  Fields,
  Interfaces extends string,
  References = unknown,
> = TypeDefinition<
  'OBJECT',
  Name,
  Shape,
  never,
  { fields: Fields; interfaces: Interfaces },
  References
>;

/** An interface type definition, as returned by `t.interface()`. */
export type InterfaceDefinition<
  Name extends string,
  Shape,
  Fields,
  Interfaces extends string,
  References = unknown,
> = TypeDefinition<
  'INTERFACE',
  Name,
  Shape,
  never,
  { fields: Fields; interfaces: Interfaces },
  References
>;

/** A union type definition, as returned by `t.union()`. */
export type UnionDefinition<Name extends string, Shape, Members extends string> = TypeDefinition<
  'UNION',
  Name,
  Shape,
  never,
  { members: Members },
  Members
>;

/** An enum type definition, as returned by `t.enum()`.
 * @param Values - The names of the enum values.
 * @param Internal - The internal values of this definition's enum values.
 */
export type EnumDefinition<
  Name extends string,
  Shape,
  Values extends string,
  Internal = Shape,
> = TypeDefinition<'ENUM', Name, Shape, Shape, { values: Values; internal: Internal }, never>;

/** A scalar type definition, as returned by `t.scalar()`.
 * @param Internal - The type of values that resolvers return for this scalar.
 * @param Serialized - The type of the scalar that clients receive and send.
 * @param Input - The type of values that resolvers receive for this scalar, as returned by `parseValue`.
 */
export type ScalarDefinition<
  Name extends string,
  Internal,
  Serialized,
  Input = Internal,
> = TypeDefinition<'SCALAR', Name, Internal, Input, { type: Serialized }, never>;

/** An input object type definition, as returned by `t.input()`. */
export type InputDefinition<
  Name extends string,
  Shape,
  Fields,
  Defaults,
  IsOneOf extends boolean,
  References = unknown,
> = TypeDefinition<
  'INPUT_OBJECT',
  Name,
  Shape,
  Shape,
  { fields: Fields; defaults: Defaults; isOneOf: IsOneOf },
  References
>;

export interface ObjectConfig<Shape, Context, Fields, Interfaces> {
  description?: string;
  /** Interfaces this object implements, including all interfaces they implement, or a function returning them. */
  interfaces?: Interfaces | (() => Interfaces);
  /** Determines whether a value belongs to this type when it's returned for an abstract type. */
  isTypeOf?: (value: unknown, context: Context, info: GraphQLResolveInfo) => MaybePromise<boolean>;
  fields?: (f: FieldBuilder<Shape, Context>) => Fields;
  directives?: readonly AppliedDirective<'OBJECT'>[];
  extensions?: Extensions;
}

export interface InterfaceConfig<Shape, Context, Fields, Interfaces> {
  description?: string;
  /** Interfaces this interface implements, including all interfaces they implement, or a function returning them. */
  interfaces?: Interfaces | (() => Interfaces);
  /** Resolves the name of the object type of a value. */
  resolveType?: (
    value: Shape,
    context: Context,
    info: GraphQLResolveInfo
  ) => MaybePromise<string | undefined>;
  fields?: (f: InterfaceFieldBuilder) => Fields;
  directives?: readonly AppliedDirective<'INTERFACE'>[];
  extensions?: Extensions;
}

type shapeOfMembers<Members extends readonly NamedRef[]> = NonNullable<Members[number]['~shape']>;

export interface UnionConfig<
  Members extends readonly NamedRef<'OBJECT'>[],
  Shape,
  Context,
  TypeName extends string = Members[number]['name'],
> {
  description?: string;
  /** Member object types of this union, or a function returning them. */
  types?: Members | (() => Members);
  /** Resolves the name of the object type of a value. */
  resolveType?: (
    value: Shape,
    context: Context,
    info: GraphQLResolveInfo
  ) => MaybePromise<TypeName | undefined>;
  directives?: readonly AppliedDirective<'UNION'>[];
  extensions?: Extensions;
}

export interface EnumValueConfig {
  /** The internal value of this enum value, which defaults to its name. */
  value?: unknown;
  description?: string;
  deprecationReason?: string;
  directives?: readonly AppliedDirective<'ENUM_VALUE'>[];
  extensions?: Extensions;
}

type EnumValuesInput = readonly string[] | { readonly [name: string]: EnumValueConfig };

type enumValueNames<Values> = Values extends readonly (infer Name extends string)[]
  ? Name
  : keyof Values & string;

type enumValuesShape<Values> = Values extends readonly (infer Name)[]
  ? Name
  : {
      [Name in keyof Values & string]: Values[Name] extends { value: infer Value } ? Value : Name;
    }[keyof Values & string];

export interface EnumConfig<Values> {
  description?: string;
  /** Either a list of value names or an object of value names to their configuration. */
  values?: Values;
  directives?: readonly AppliedDirective<'ENUM'>[];
  extensions?: Extensions;
}

export type ScalarConfig<Internal, Serialized, Input> = {
  description?: string;
  /** A URL to a human-readable specification of this scalar. */
  specifiedByURL?: string;
  /** Serializes an internal value for the response. */
  serialize: (value: Internal) => Serialized;
  directives?: readonly AppliedDirective<'SCALAR'>[];
  extensions?: Extensions;
} & (
  | {
      /** Parses an input value from variables. Without it, resolvers receive input values as-is. */
      parseValue: (value: unknown) => Input;
      /** Parses an input value from a literal in a document. Requires `parseValue`. */
      parseLiteral?: (
        valueNode: ValueNode,
        variables?: { readonly [name: string]: unknown } | null
      ) => Input;
    }
  | { parseValue?: undefined; parseLiteral?: undefined }
);

export interface ScalarExtensionConfig {
  description?: string;
  directives?: readonly AppliedDirective<'SCALAR'>[];
  extensions?: Extensions;
}

type checkInputFields<Fields> = {
  fields?:
    | checkInputValues<Fields, 'INPUT_FIELD_DEFINITION'>
    | (() => checkInputValues<Fields, 'INPUT_FIELD_DEFINITION'>);
};

export interface InputConfig<Fields, IsOneOf extends boolean> {
  description?: string;
  /** Marks this input object as a OneOf Input Object, of which exactly one field must be set. */
  isOneOf?: IsOneOf;
  /** The input object's fields, or a function returning them. */
  fields?: Fields | (() => Fields);
  directives?: readonly AppliedDirective<'INPUT_OBJECT'>[];
  extensions?: Extensions;
}

type checkEnumShape<Name extends string, Shape, Values> = [
  Exclude<enumValuesShape<Values>, Shape>,
] extends [never]
  ? unknown
  : {
      '~error': `Internal values of "${Name}" don't match its reference's type: ${Extract<
        Exclude<enumValuesShape<Values>, Shape>,
        string | number | boolean | bigint
      >}`;
    };

type keysOfUnion<T> = T extends unknown ? keyof T : never;

type checkInputShape<Name extends string, Shape, Fields, IsOneOf extends boolean> = [
  Exclude<keyof Fields, IsOneOf extends true ? keysOfUnion<Shape> : keyof Shape>,
] extends [never]
  ? (
      IsOneOf extends true
        ? inputObjectShape<Fields, true> extends Shape
          ? true
          : false
        : InputValuesShape<Fields> extends Pick<Shape, keyof Fields & keyof Shape>
          ? true
          : false
    ) extends true
    ? unknown
    : { '~error': `Fields of "${Name}" don't match its reference's type` }
  : {
      '~error': `Fields of "${Name}" are missing from its reference's type: ${Extract<
        Exclude<keyof Fields, IsOneOf extends true ? keysOfUnion<Shape> : keyof Shape>,
        string
      >}`;
    };

type inputObjectShape<Fields, IsOneOf extends boolean> = IsOneOf extends true
  ? {
      [Name in keyof Fields]: {
        -readonly [P in Name]: NonNullable<InputShape<inputValueType<Fields[Name]>>>;
      };
    }[keyof Fields]
  : InputValuesShape<Fields>;

export interface DirectiveConfig<Locations, Args> {
  description?: string;
  locations: Locations;
  args?: Args & checkInputValues<Args, 'ARGUMENT_DEFINITION'>;
  /** Allows the directive to be used more than once at a single location. */
  isRepeatable?: boolean;
  extensions?: Extensions;
}

type definitionsByName<Definitions> = {
  [Definition in Definitions as Definition extends { name: infer Name extends string }
    ? Name
    : never]: Definition;
};

type fragmentsOf<Group> = Group extends { readonly '~fragment'?: infer Fragment }
  ? NonNullable<Fragment>
  : never;

type mergeFields<Fragments> =
  obj<
    unionToIntersection<Fragments extends { fields: infer Fields } ? Fields : never>
  > extends infer Fields extends { [name: string]: TadaTypeRef }
    ? Fields
    : never;

type implementorsOf<Definitions, InterfaceName> = Definitions extends {
  kind: 'OBJECT';
  name: infer ObjectName;
  readonly '~fragment'?: infer Fragment;
}
  ? NonNullable<Fragment> extends { interfaces: infer Interfaces }
    ? InterfaceName extends Interfaces
      ? ObjectName
      : never
    : never
  : never;

type toTadaType<Name extends string, Group, Definitions> = Group['kind' &
  keyof Group] extends 'OBJECT'
  ? TadaObjectType<Name, mergeFields<fragmentsOf<Group>>>
  : Group['kind' & keyof Group] extends 'INTERFACE'
    ? TadaInterfaceType<
        Name,
        mergeFields<fragmentsOf<Group>>,
        implementorsOf<Definitions, Name> & string
      >
    : Group['kind' & keyof Group] extends 'UNION'
      ? TadaUnionType<Name, fragmentsOf<Group>['members' & keyof fragmentsOf<Group>] & string>
      : Group['kind' & keyof Group] extends 'ENUM'
        ? TadaEnumType<Name, fragmentsOf<Group>['values' & keyof fragmentsOf<Group>] & string>
        : Group['kind' & keyof Group] extends 'SCALAR'
          ? TadaScalarType<Name, fragmentsOf<Group>['type' & keyof fragmentsOf<Group>]>
          : Group['kind' & keyof Group] extends 'INPUT_OBJECT'
            ? mergeFields<fragmentsOf<Group>> extends infer Fields extends {
                [name: string]: TadaTypeRef;
              }
              ? TadaInputObjectType<
                  Name,
                  Fields,
                  fragmentsOf<Group>['defaults' & keyof fragmentsOf<Group>] & keyof Fields,
                  true extends fragmentsOf<Group>['isOneOf' & keyof fragmentsOf<Group>]
                    ? true
                    : false
                >
              : never
            : never;

type assembleTypes<Definitions> = {
  [Name in keyof definitionsByName<Definitions> & string]: toTadaType<
    Name,
    definitionsByName<Definitions>[Name],
    Definitions
  >;
}[keyof definitionsByName<Definitions> & string];

type rootName<Root> = Root extends NamedRef<'OBJECT', infer Name> ? Name : never;

/** The gql.tada schema type derived from a schema's definitions. */
export type schemaOfDefinitions<
  Query,
  Mutation,
  Subscription,
  Definitions,
  SchemaName extends string = never,
> = TadaSchema<{
  name: SchemaName;
  query: rootName<Query>;
  mutation: rootName<Mutation>;
  subscription: rootName<Subscription>;
  types: assembleTypes<Definitions>;
}>;

type requiredKeys<T> = {
  [Key in keyof T]-?: {} extends Pick<T, Key> ? never : Key;
}[keyof T];

/** Types defined from references whose types aren't covered by all of their definitions */
type incompleteDefinitions<Definitions> = {
  [Name in keyof definitionsByName<Definitions> &
    string]: definitionsByName<Definitions>[Name] extends infer Group
    ? {} extends NonNullable<Group['~shape' & keyof Group]>
      ? never
      : Group['kind' & keyof Group] extends 'ENUM'
        ? [
            Exclude<
              NonNullable<Group['~shape' & keyof Group]>,
              fragmentsOf<Group>['internal' & keyof fragmentsOf<Group>]
            >,
          ] extends [never]
          ? never
          : Name
        : Group['kind' & keyof Group] extends 'INPUT_OBJECT'
          ? [
              Exclude<
                requiredKeys<NonNullable<Group['~input' & keyof Group]>>,
                keyof mergeFields<fragmentsOf<Group>>
              >,
            ] extends [never]
            ? never
            : Name
          : never
    : never;
}[keyof definitionsByName<Definitions> & string];

type referencedNames<Definitions> = Definitions extends { readonly '~references'?: infer Names }
  ? NonNullable<Names>
  : never;

type missingDefinitions<Definitions, Roots, Directives> = Exclude<
  referencedNames<Definitions> | referencedNames<Directives> | rootName<Roots>,
  (Definitions extends { name: infer Name } ? Name : never) | BuiltinScalarName
>;

type nonLiteralNames<Definitions> = Definitions extends { name: infer Name }
  ? string extends Name
    ? true
    : never
  : never;

type checkDefinitions<Definitions, Roots, Directives> = [nonLiteralNames<Definitions>] extends [
  never,
]
  ? checkReferences<Definitions, Roots, Directives>
  : { '~error': 'Type names must be string literals, but a definition has a `string` name' };

type checkReferences<Definitions, Roots, Directives> = [
  missingDefinitions<Definitions, Roots, Directives>,
] extends [never]
  ? [incompleteDefinitions<Definitions>] extends [never]
    ? unknown
    : {
        '~error': `Values or fields of these types' references are never defined: ${incompleteDefinitions<Definitions>}`;
      }
  : {
      '~error': `Types are referenced but missing from schema({ types }): ${missingDefinitions<
        Definitions,
        Roots,
        Directives
      > &
        string}`;
    };

type checkRoots<Query, Mutation, Subscription> = [
  | (rootName<Query> & rootName<Mutation>)
  | (rootName<Query> & rootName<Subscription>)
  | (rootName<Mutation> & rootName<Subscription>),
] extends [never]
  ? unknown
  : { '~error': 'The query, mutation, and subscription root types must all be different' };

export interface SchemaConfig<Query, Mutation, Subscription, Types, Directives, SchemaName> {
  /** Identifies the schema in gql.tada's multi-schema mode (type-only). */
  name?: SchemaName;
  description?: string;
  /** The query root operation type. */
  query: Query;
  /** The mutation root operation type. */
  mutation?: Mutation;
  /** The subscription root operation type. */
  subscription?: Subscription;
  /** All type definitions of the schema, including all definitions extending a type. */
  types?: Types;
  /** Custom directive definitions. Built-in directives are always included. */
  directives?: Directives;
  /** Directives applied to the schema. */
  schemaDirectives?: readonly AppliedDirective<'SCHEMA'>[];
  /** Skips validating the schema when it's created. */
  assumeValid?: boolean;
  extensions?: Extensions;
}

type AnySchemaConfig = SchemaConfig<
  NamedRef<'OBJECT'>,
  NamedRef<'OBJECT'>,
  NamedRef<'OBJECT'>,
  readonly AnyTypeDefinition[],
  readonly DirectiveDefinition<string, any, any>[],
  string
>;

// NOTE: The schema's config is inferred as a whole. Inferring each option separately lets TypeScript
// 7 infer omitted root types from the checks that reference them
type configValue<Config, Key extends string> = Key extends keyof Config
  ? Exclude<Config[Key], undefined>
  : never;

type itemsOf<List> = List extends readonly (infer Item)[] ? Item : never;
type configItems<Config, Key extends string> = itemsOf<configValue<Config, Key>>;

type configDefinitions<Config> =
  | configItems<Config, 'types'>
  | Extract<configValue<Config, 'query' | 'mutation' | 'subscription'>, AnyTypeDefinition>;

/** A `GraphQLSchema` that carries its gql.tada schema type. See `IntrospectionOf`. */
export type TadaGraphQLSchema<Schema> = GraphQLSchema & TadaSchemaCarrier<Schema>;

/** The schema builder returned by {@link initSchemaBuilder}. */
export interface SchemaBuilder<Context> {
  readonly ID: typeof ID;
  readonly String: typeof String;
  readonly Int: typeof Int;
  readonly Float: typeof Float;
  readonly Boolean: typeof Boolean;
  readonly nonNull: typeof nonNull;
  readonly list: typeof list;

  /** Creates a reference to an object type, to be defined with `t.object()`.
   * @param Shape - The type of values that resolvers return for this type.
   */
  objectRef<Shape = unknown>(): <const Name extends string>(
    name: Name
  ) => NamedRef<'OBJECT', Name, Shape, never>;

  /** Creates a reference to an interface type, to be defined with `t.interface()`.
   * @param Shape - The type of values that resolvers return for this type.
   */
  interfaceRef<Shape = unknown>(): <const Name extends string>(
    name: Name
  ) => NamedRef<'INTERFACE', Name, Shape, never>;

  /** Creates a reference to an input object type, to be defined with `t.input()`.
   *
   * @remarks
   * A reference is required for input objects that reference themselves, or that are
   * defined by several `t.input()` calls. Its fields are checked against `Shape`.
   *
   * Naming `Shape` also keeps emitted declarations small for deeply nested input objects,
   * whose shapes are otherwise inferred and inlined.
   *
   * @param Shape - The type of values that resolvers receive for this type.
   */
  inputRef<Shape>(): <const Name extends string>(
    name: Name
  ) => NamedRef<'INPUT_OBJECT', Name, Shape, Shape>;

  /** Creates a reference to a union type, to be defined with `t.union()`.
   *
   * @remarks
   * A reference is required for unions that are defined by several `t.union()` calls.
   *
   * @param Shape - The type of values that resolvers return for this type.
   */
  unionRef<Shape>(): <const Name extends string>(
    name: Name
  ) => NamedRef<'UNION', Name, Shape, never>;

  /** Creates a reference to an enum type, to be defined with `t.enum()`.
   *
   * @remarks
   * A reference is required for enums that are defined by several `t.enum()` calls. The
   * internal values of their values are checked against `Values`.
   *
   * @param Values - The internal values of the enum.
   */
  enumRef<Values>(): <const Name extends string>(
    name: Name
  ) => NamedRef<'ENUM', Name, Values, Values>;

  /** Defines an object type, or extends it when called again with the same reference. */
  object<
    Name extends string,
    Shape,
    const Fields = {},
    const Interfaces extends readonly NamedRef<'INTERFACE'>[] = [],
  >(
    ref: NamedRef<'OBJECT', Name, Shape, any>,
    config: ObjectConfig<Shape, Context, Fields, Interfaces> &
      checkFieldResolvers<Name, Shape, Fields, Context>
  ): ObjectDefinition<
    Name,
    Shape,
    obj<toTadaFields<Fields>>,
    Interfaces[number]['name'],
    fieldsNamedTypes<Fields> | Interfaces[number]['name']
  >;

  /** Defines an interface type, or extends it when called again with the same reference. */
  interface<
    Name extends string,
    Shape,
    const Fields = {},
    const Interfaces extends readonly NamedRef<'INTERFACE'>[] = [],
  >(
    ref: NamedRef<'INTERFACE', Name, Shape, any>,
    config: InterfaceConfig<Shape, Context, Fields, Interfaces>
  ): InterfaceDefinition<
    Name,
    Shape,
    obj<toTadaFields<Fields>>,
    Interfaces[number]['name'],
    fieldsNamedTypes<Fields> | Interfaces[number]['name']
  >;

  /** Defines a union type. */
  union<const Name extends string, const Members extends readonly NamedRef<'OBJECT'>[]>(
    name: Name,
    config: UnionConfig<Members, shapeOfMembers<Members>, Context> & {
      types: Members | (() => Members);
    }
  ): UnionDefinition<Name, shapeOfMembers<Members>, Members[number]['name']>;
  /** Defines a union type from a reference (see `t.unionRef()`), or extends it. */
  union<
    const Ref extends NamedRef<'UNION'>,
    const Members extends readonly NamedRef<'OBJECT'>[] = [],
  >(
    ref: Ref & RefOnly,
    // NOTE: Members may be added by other definitions, so `resolveType` may return any type name
    config: UnionConfig<Members, NonNullable<Ref['~shape']>, Context, string>
  ): UnionDefinition<Ref['name'], NonNullable<Ref['~shape']>, Members[number]['name']>;

  /** Defines an enum type. */
  enum<const Name extends string, const Values extends EnumValuesInput>(
    name: Name,
    config: EnumConfig<Values> & { values: Values }
  ): EnumDefinition<Name, enumValuesShape<Values>, enumValueNames<Values>>;
  /** Defines an enum type from a reference (see `t.enumRef()`), or extends it. */
  enum<const Ref extends NamedRef<'ENUM'>, const Values extends EnumValuesInput = []>(
    ref: Ref & RefOnly,
    config: EnumConfig<Values> & checkEnumShape<Ref['name'], NonNullable<Ref['~shape']>, Values>
  ): EnumDefinition<
    Ref['name'],
    NonNullable<Ref['~shape']>,
    enumValueNames<Values>,
    enumValuesShape<Values>
  >;

  /** Defines a custom scalar type.
   *
   * @remarks
   * The scalar's internal type is inferred from `serialize`'s parameter, and the type that
   * resolvers receive as inputs from `parseValue`'s return type (or `unknown` without it).
   * Clients see the scalar as `serialize`'s return type.
   */
  scalar<const Name extends string, Internal, Serialized, Input = unknown>(
    name: Name,
    config: ScalarConfig<Internal, Serialized, Input>
  ): ScalarDefinition<Name, Internal, Serialized, Input>;
  /** Extends a custom scalar type. */
  scalar<Name extends string, Internal, Input>(
    ref: NamedRef<'SCALAR', Name, Internal, Input>,
    config: ScalarExtensionConfig
  ): ScalarDefinition<Name, Internal, never, Input>;

  /** Defines an input object type. */
  input<
    const Name extends string,
    const Fields extends InputValuesInput,
    const IsOneOf extends boolean = false,
  >(
    name: Name,
    config: InputConfig<Fields, IsOneOf> & {
      fields: Fields | (() => Fields);
    } & checkInputFields<Fields>
  ): InputDefinition<
    Name,
    inputObjectShape<Fields, IsOneOf>,
    obj<toTadaInputFields<Fields>>,
    defaultedInputValues<Fields>,
    IsOneOf,
    inputValuesNamedTypes<Fields>
  >;
  /** Defines an input object type from a reference (see `t.inputRef()`), or extends it. */
  input<
    const Ref extends NamedRef<'INPUT_OBJECT'>,
    const Fields extends InputValuesInput = {},
    const IsOneOf extends boolean = false,
  >(
    ref: Ref & RefOnly,
    config: InputConfig<Fields, IsOneOf> &
      checkInputFields<Fields> &
      checkInputShape<Ref['name'], NonNullable<Ref['~input']>, Fields, IsOneOf>
  ): InputDefinition<
    Ref['name'],
    NonNullable<Ref['~input']>,
    obj<toTadaInputFields<Fields>>,
    defaultedInputValues<Fields>,
    IsOneOf,
    inputValuesNamedTypes<Fields>
  >;

  /** Defines a custom directive. Pass it to `schema({ directives })`. */
  directive<
    const Name extends string,
    const Locations extends readonly DirectiveLocationName[],
    const Args extends InputValuesInput = {},
  >(
    name: Name,
    config: DirectiveConfig<Locations, Args>
  ): DirectiveDefinition<Name, Locations[number], Args>;

  /** Applies a directive to a type system element, via its `directives` option. */
  apply<const Directive extends DirectiveDefinition<string, any, any>>(
    directive: Directive,
    ...args: {} extends InputValuesRequest<NonNullable<Directive['~args']>>
      ? [args?: InputValuesRequest<NonNullable<Directive['~args']>>]
      : [args: InputValuesRequest<NonNullable<Directive['~args']>>]
  ): AppliedDirective<NonNullable<Directive['~location']>>;

  /** Creates the `GraphQLSchema`.
   *
   * @remarks
   * The returned schema carries its gql.tada schema type, which clients can
   * retrieve with `IntrospectionOf<typeof schema>`.
   *
   * The schema is validated when it's created, unless `assumeValid` is set.
   */
  schema<const Config extends AnySchemaConfig, const SchemaName extends string = never>(
    config: Config & { name?: SchemaName } & {
      [Key in Exclude<keyof Config, keyof AnySchemaConfig>]: never;
    } & checkRoots<
        configValue<Config, 'query'>,
        configValue<Config, 'mutation'>,
        configValue<Config, 'subscription'>
      > &
      checkDefinitions<
        configDefinitions<Config>,
        configValue<Config, 'query' | 'mutation' | 'subscription'>,
        configItems<Config, 'directives'>
      >
  ): TadaGraphQLSchema<
    schemaOfDefinitions<
      configValue<Config, 'query'>,
      configValue<Config, 'mutation'>,
      configValue<Config, 'subscription'>,
      configDefinitions<Config>,
      SchemaName
    >
  >;
}

interface BuilderSetup {
  /** The type of the context value that's passed to resolvers. */
  context?: unknown;
}

const fieldBuilder = { field: (config: unknown) => config };

const define = (kind: string, ref: string | NamedRef, config: unknown): any => ({
  kind,
  name: typeof ref === 'string' ? ref : ref.name,
  '~config': config,
});

/** Creates a schema builder.
 *
 * @remarks
 * The builder defines a GraphQL schema with `graphql`'s type system and derives a gql.tada
 * schema type from its definitions. Clients may then pass `IntrospectionOf<typeof schema>`
 * to `initGraphQLTada()` to type their documents against it, without code generation.
 *
 * @example
 * ```ts
 * import { initSchemaBuilder } from 'gql.tada/server';
 *
 * const t = initSchemaBuilder<{ context: { userId: string } }>();
 *
 * const Query = t.object(t.objectRef()('Query'), {
 *   fields: (f) => ({
 *     me: f.field({ type: t.nonNull(t.ID), resolve: (_, _args, ctx) => ctx.userId }),
 *   }),
 * });
 *
 * export const schema = t.schema({ query: Query });
 * ```
 */
export function initSchemaBuilder<const Setup extends BuilderSetup = {}>(): SchemaBuilder<
  Setup extends { context: infer Context } ? Context : unknown
> {
  const builder = {
    ID,
    String,
    Int,
    Float,
    Boolean,
    nonNull,
    list,
    objectRef: () => (name: string) => ({ kind: 'OBJECT', name }),
    interfaceRef: () => (name: string) => ({ kind: 'INTERFACE', name }),
    inputRef: () => (name: string) => ({ kind: 'INPUT_OBJECT', name }),
    unionRef: () => (name: string) => ({ kind: 'UNION', name }),
    enumRef: () => (name: string) => ({ kind: 'ENUM', name }),
    object: (ref: NamedRef, config: unknown) => define('OBJECT', ref, config),
    interface: (ref: NamedRef, config: unknown) => define('INTERFACE', ref, config),
    union: (ref: string | NamedRef, config: unknown) => define('UNION', ref, config),
    enum: (ref: string | NamedRef, config: unknown) => define('ENUM', ref, config),
    scalar: (ref: string | NamedRef, config: unknown) => define('SCALAR', ref, config),
    input: (ref: string | NamedRef, config: unknown) => define('INPUT_OBJECT', ref, config),
    directive: (name: string, config: unknown) => define('DIRECTIVE', name, config),
    apply: (directive: DirectiveDefinition, args?: { [name: string]: unknown }) => ({
      directive,
      args: args || {},
    }),
    schema: (config: SchemaConfig<any, any, any, any, any, any>) =>
      buildSchema(config, fieldBuilder),
  };
  return builder as any;
}
