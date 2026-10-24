import type { GraphQLDirective, GraphQLResolveInfo } from 'graphql';
import type { AuthRule } from './auth';

type Extensions = { readonly [key: string]: unknown };

/** Options that plugins add to fields of object types, via declaration merging.
 *
 * @example
 * ```ts
 * declare module 'gql.tada/server' {
 *   interface FieldPluginOptions<Parent, Context, Args> {
 *     cost?: number;
 *   }
 * }
 * ```
 */
export interface FieldPluginOptions<Parent, Context, Args> {
  /** The field's authorization rule, which replaces its type's rule. Requires `authPlugin()`.
   * `true` always allows access, and `false` always denies it.
   */
  authorize?: AuthRule<Parent, Context, Args> | boolean;
}

/** Options that plugins add to object types, via declaration merging. */
export interface TypePluginOptions<Shape, Context> {
  /** The authorization rule of this type's fields without their own rule. Requires `authPlugin()`. */
  authorize?: AuthRule<Shape, Context, { readonly [name: string]: unknown }> | boolean;
}

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
  /** The field's options, including plugin options. */
  readonly options: { readonly [key: string]: unknown };
  /** The plugin options of the field's type, merged from all of its definitions. */
  readonly typeOptions: { readonly [key: string]: unknown };
}

/** An object type, as plugins see it when the schema is built. */
export interface PluginType {
  readonly name: string;
  /** The plugin options of the type, merged from all of its definitions. */
  readonly options: { readonly [key: string]: unknown };
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
