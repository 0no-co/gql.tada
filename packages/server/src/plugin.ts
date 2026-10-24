import type { GraphQLDirective, GraphQLResolveInfo } from 'graphql';

type Extensions = { readonly [key: string]: unknown };

/** Options that plugins add to fields of object types, via declaration merging.
 *
 * @remarks
 * Merged declarations must use the same type parameter names. `Parent` is the type of the
 * field's parent value, `Context` the builder's context type, and `Args` the type of the
 * field's arguments, as its resolver receives them.
 *
 * @example
 * ```ts
 * declare module '@gql.tada/server' {
 *   interface FieldPluginOptions<Parent, Context, Args> {
 *     cost?: number | ((args: Args, context: Context) => number);
 *   }
 * }
 * ```
 */
export interface FieldPluginOptions<Parent, Context, Args> {}

/** Options that plugins add to object types, via declaration merging.
 *
 * @remarks
 * `Shape` is the object type's backing type, and `Context` the builder's context type.
 */
export interface TypePluginOptions<Shape, Context> {}

type Options<Declared> = Declared & { readonly [key: string]: unknown };

/** A field resolver, or a subscription field's `subscribe` function. */
export type FieldResolver<Context = any> = (
  source: any,
  args: any,
  context: Context,
  info: GraphQLResolveInfo
) => unknown;

/** A field, as plugins see it when the schema is built. */
export interface PluginField {
  readonly typeName: string;
  readonly fieldName: string;
  /** The root operation type that the field belongs to, if any. */
  readonly operation: 'query' | 'mutation' | 'subscription' | undefined;
  /** The field's options, including plugin options. These aren't validated at runtime. */
  readonly options: Options<FieldPluginOptions<any, any, any>>;
  /** The plugin options of the field's type, merged from all of its definitions. */
  readonly typeOptions: Options<TypePluginOptions<any, any>>;
}

/** An object type, as plugins see it when the schema is built. */
export interface PluginType {
  readonly name: string;
  /** The plugin options of the type, merged from all of its definitions. */
  readonly options: Options<TypePluginOptions<any, any>>;
}

/** A schema builder plugin. Pass plugins to `initSchemaBuilder({ plugins })`.
 *
 * @remarks
 * Hooks run once per field or type when the schema is built. Resolver wrappers run in the
 * order plugins are passed, so the first plugin's wrapper is the outermost. Plugins can't
 * change types or arguments, which keeps the schema's gql.tada type accurate.
 */
export interface SchemaPlugin<Context = any> {
  readonly name: string;
  /** Names of the field options that this plugin reads. */
  readonly fieldOptions?: readonly string[];
  /** Names of the object type options that this plugin reads. */
  readonly typeOptions?: readonly string[];
  /** Wraps a field's resolver. Fields without a resolver pass the default resolver. */
  wrapResolve?(next: FieldResolver<Context>, field: PluginField): FieldResolver<Context> | void;
  /** Wraps a subscription root field's `subscribe` function. */
  wrapSubscribe?(next: FieldResolver<Context>, field: PluginField): FieldResolver<Context> | void;
  /** Adds extensions to a field. */
  onField?(field: PluginField): { extensions?: Extensions } | void;
  /** Adds extensions to an object type. */
  onType?(type: PluginType): { extensions?: Extensions } | void;
  /** Adds directives and extensions to the schema. */
  onSchema?(): { directives?: readonly GraphQLDirective[]; extensions?: Extensions } | void;
}
