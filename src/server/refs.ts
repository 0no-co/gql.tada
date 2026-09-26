import type { obj } from '../utils';
import type { TadaNamedTypeRef, TadaNonNullTypeRef, TadaListTypeRef } from './contract';

export type MaybePromise<T> = T | PromiseLike<T>;

/** Guards recursive utilities against `any` and the recursive `OutputRef`/`InputRef` unions (e.g. when
 * type inference falls back to a constraint), which would otherwise recurse infinitely */
type isAny<T> = 0 extends 1 & T
  ? true
  : [OutputRef] extends [T]
    ? true
    : [InputRef] extends [T]
      ? true
      : false;

export type OutputKind = 'SCALAR' | 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM';
export type InputKind = 'SCALAR' | 'ENUM' | 'INPUT_OBJECT';
export type NamedKind = OutputKind | 'INPUT_OBJECT';

/** A reference to a named type.
 *
 * @remarks
 * References only carry a type's name and the TypeScript types of its values, but never
 * its fields. This allows types to reference each other (and themselves) without creating
 * circular type inference.
 *
 * @param Shape - The type of values that resolvers return for this type.
 * @param Input - The type of values that resolvers receive when this type is used as an input.
 */
export interface NamedRef<
  Kind extends NamedKind = NamedKind,
  Name extends string = string,
  Shape = any,
  Input = any,
> {
  readonly kind: Kind;
  readonly name: Name;
  /** @internal Type-only */
  readonly '~shape'?: Shape;
  /** @internal Type-only */
  readonly '~input'?: Input;
}

/** A reference to a Non-Null wrapping type. See {@link nonNull}. */
export interface NonNullRef<OfType extends NamedRef | ListRef<any> = NamedRef | ListRef<any>> {
  readonly kind: 'NON_NULL';
  readonly ofType: OfType;
}

/** A reference to a List wrapping type. See {@link list}. */
export interface ListRef<OfType extends TypeRef = TypeRef> {
  readonly kind: 'LIST';
  readonly ofType: OfType;
}

export type TypeRef = NamedRef | ListRef<any> | NonNullRef<any>;

type OutputNamedRef = NamedRef<OutputKind>;
/** A type reference that's valid as a field's output type. */
export type OutputRef =
  | OutputNamedRef
  | ListRef<OutputRef>
  | NonNullRef<OutputNamedRef | ListRef<OutputRef>>;

type InputNamedRef = NamedRef<InputKind>;
/** A type reference that's valid as an argument's or input field's type. */
export type InputRef =
  | InputNamedRef
  | ListRef<InputRef>
  | NonNullRef<InputNamedRef | ListRef<InputRef>>;

/** Wraps a type in a Non-Null type. */
export function nonNull<const OfType extends NamedRef | ListRef<any>>(
  ofType: OfType
): NonNullRef<OfType> {
  return { kind: 'NON_NULL', ofType };
}

/** Wraps a type in a List type. */
export function list<const OfType extends TypeRef>(ofType: OfType): ListRef<OfType> {
  return { kind: 'LIST', ofType };
}

/** The value a resolver may return for a given output type. */
export type OutputShape<Ref> =
  isAny<Ref> extends true
    ? any
    : Ref extends NonNullRef<infer OfType>
      ? outputShapeNonNull<OfType>
      : outputShapeNonNull<Ref> | null | undefined;
type outputShapeNonNull<Ref> =
  Ref extends ListRef<infer OfType>
    ? // NOTE: Lists may be any iterable object (but not strings), as with graphql-js
      Iterable<MaybePromise<OutputShape<OfType>>> & object
    : Ref extends NamedRef<any, any, infer Shape, any>
      ? Shape
      : never;

/** The value a resolver receives for a given input type. */
export type InputShape<Ref> =
  isAny<Ref> extends true
    ? any
    : Ref extends NonNullRef<infer OfType>
      ? inputShapeNonNull<OfType>
      : inputShapeNonNull<Ref> | null;
type inputShapeNonNull<Ref> =
  Ref extends ListRef<infer OfType>
    ? InputShape<OfType>[]
    : Ref extends NamedRef<any, any, any, infer Input>
      ? Input
      : never;

/** Converts a type reference to the gql.tada contract's type reference. */
export type toTadaTypeRef<Ref> =
  isAny<Ref> extends true
    ? any
    : Ref extends NonNullRef<infer OfType>
      ? TadaNonNullTypeRef<toTadaTypeRef<OfType>>
      : Ref extends ListRef<infer OfType>
        ? TadaListTypeRef<toTadaTypeRef<OfType>>
        : Ref extends NamedRef<infer Kind, infer Name, any, any>
          ? TadaNamedTypeRef<Kind, Name>
          : never;

/** Returns the name of the named type that's wrapped by a type reference. */
export type namedTypeOf<Ref> =
  isAny<Ref> extends true
    ? string
    : Ref extends NonNullRef<infer OfType>
      ? namedTypeOf<OfType>
      : Ref extends ListRef<infer OfType>
        ? namedTypeOf<OfType>
        : Ref extends NamedRef<any, infer Name, any, any>
          ? Name
          : never;

/** Locations a directive may be used in executable documents. */
export type ExecutableDirectiveLocation =
  | 'QUERY'
  | 'MUTATION'
  | 'SUBSCRIPTION'
  | 'FIELD'
  | 'FRAGMENT_DEFINITION'
  | 'FRAGMENT_SPREAD'
  | 'INLINE_FRAGMENT'
  | 'VARIABLE_DEFINITION';

/** Locations a directive may be applied to in the type system. */
export type TypeSystemDirectiveLocation =
  | 'SCHEMA'
  | 'SCALAR'
  | 'OBJECT'
  | 'FIELD_DEFINITION'
  | 'ARGUMENT_DEFINITION'
  | 'INTERFACE'
  | 'UNION'
  | 'ENUM'
  | 'ENUM_VALUE'
  | 'INPUT_OBJECT'
  | 'INPUT_FIELD_DEFINITION';

export type DirectiveLocationName = ExecutableDirectiveLocation | TypeSystemDirectiveLocation;

/** A directive definition, as returned by `t.directive()`. */
export interface DirectiveDefinition<
  Name extends string = string,
  Location extends DirectiveLocationName = DirectiveLocationName,
  Args = any,
> {
  readonly kind: 'DIRECTIVE';
  readonly name: Name;
  /** @internal */
  readonly '~config': any;
  /** @internal Type-only */
  readonly '~location'?: Location;
  /** @internal Type-only */
  readonly '~args'?: Args;
  /** @internal Type-only */
  readonly '~references'?: inputValuesNamedTypes<Args>;
}

/** A directive applied to a type system element, as returned by `t.apply()`.
 *
 * @remarks
 * Applied directives are validated against their definition's locations, arguments, and
 * `isRepeatable` flag, and are exposed on the element's `extensions.directives`. As per the
 * GraphQL specification they're not part of introspection.
 */
export interface AppliedDirective<Location extends string = any> {
  readonly directive: DirectiveDefinition<string, any, any>;
  readonly args: { readonly [name: string]: unknown };
  /** @internal Type-only. Checks locations via parameter contravariance. */
  readonly '~location'?: (location: Location) => void;
}

/** A default value for a given input type (lists may be readonly) */
export type InputDefault<Ref> =
  isAny<Ref> extends true
    ? any
    : Ref extends NonNullRef<infer OfType>
      ? inputDefaultNonNull<OfType>
      : inputDefaultNonNull<Ref> | null;
// NOTE: Default values must be valid internal values, since graphql-js serializes them for introspection
type inputDefaultNonNull<Ref> =
  Ref extends ListRef<infer OfType>
    ? readonly InputDefault<OfType>[]
    : Ref extends NamedRef<any, any, infer Shape, infer Input>
      ? Input & Shape
      : never;

/** Configuration for an argument or input field.
 *
 * @remarks
 * Arguments and input fields may either be passed as a type reference or as this
 * configuration object.
 */
export interface InputValueConfig<Type extends InputRef = InputRef, Location extends string = any> {
  type: Type;
  /** A default value, which is used when no value is provided. */
  defaultValue?: InputDefault<Type>;
  description?: string;
  /** Marks this value as deprecated. Only nullable or defaulted values may be deprecated. */
  deprecationReason?: string;
  directives?: readonly AppliedDirective<Location>[];
  extensions?: { readonly [key: string]: unknown };
}

export type InputValuesInput = { readonly [name: string]: InputRef | InputValueConfig<any> };

export type inputValueType<Value> = Value extends { type: infer Type } ? Type : Value;

/** Checks every input value's `defaultValue` against its own type. */
export type checkInputValues<Values, Location extends string> = {
  [Name in keyof Values & string]: Values[Name] extends { type: infer Type extends InputRef }
    ? InputValueConfig<Type, Location>
    : InputRef;
};

type hasDefault<Value> = Value extends { defaultValue: any } ? true : false;

/** Values as a resolver receives them, after defaults have been applied. */
export type InputValuesShape<Values> = obj<
  {
    -readonly [Name in keyof Values as inputValueType<Values[Name]> extends NonNullRef<any>
      ? Name
      : hasDefault<Values[Name]> extends true
        ? Name
        : never]: InputShape<inputValueType<Values[Name]>>;
  } & {
    -readonly [Name in keyof Values as inputValueType<Values[Name]> extends NonNullRef<any>
      ? never
      : hasDefault<Values[Name]> extends true
        ? never
        : Name]?: InputShape<inputValueType<Values[Name]>>;
  }
>;

/** Values as they must be passed in, before defaults are applied. */
export type InputValuesRequest<Values> = obj<
  {
    -readonly [Name in keyof Values as inputValueType<Values[Name]> extends NonNullRef<any>
      ? hasDefault<Values[Name]> extends true
        ? never
        : Name
      : never]: InputShape<inputValueType<Values[Name]>>;
  } & {
    -readonly [Name in keyof Values as inputValueType<Values[Name]> extends NonNullRef<any>
      ? hasDefault<Values[Name]> extends true
        ? Name
        : never
      : Name]?: InputShape<inputValueType<Values[Name]>>;
  }
>;

/** Names of input values that have a default value. */
export type defaultedInputValues<Values> = {
  [Name in keyof Values]: hasDefault<Values[Name]> extends true ? Name : never;
}[keyof Values];

/** Names of all named types referenced by a map of input values. */
export type inputValuesNamedTypes<Values> = {
  [Name in keyof Values]: namedTypeOf<inputValueType<Values[Name]>>;
}[keyof Values];

/** Converts a map of input values to the contract's input fields. */
export type toTadaInputFields<Values> = {
  [Name in keyof Values & string]: toTadaTypeRef<inputValueType<Values[Name]>>;
};

export type BuiltinScalarName = 'ID' | 'String' | 'Int' | 'Float' | 'Boolean';

const builtinScalar = (name: BuiltinScalarName): NamedRef => ({ kind: 'SCALAR', name });

/** The built-in `ID` scalar. Resolvers may return strings or numbers. */
export const ID = builtinScalar('ID') as NamedRef<'SCALAR', 'ID', string | number, string>;
/** The built-in `String` scalar. */
export const String = builtinScalar('String') as NamedRef<'SCALAR', 'String', string, string>;
/** The built-in `Int` scalar. */
export const Int = builtinScalar('Int') as NamedRef<'SCALAR', 'Int', number, number>;
/** The built-in `Float` scalar. */
export const Float = builtinScalar('Float') as NamedRef<'SCALAR', 'Float', number, number>;
/** The built-in `Boolean` scalar. */
export const Boolean = builtinScalar('Boolean') as NamedRef<'SCALAR', 'Boolean', boolean, boolean>;
