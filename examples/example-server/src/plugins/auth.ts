import type { GraphQLResolveInfo } from 'graphql';
import { GraphQLError } from 'graphql';

import type { FieldResolver, PluginField, SchemaPlugin } from '@gql.tada/server';

type MaybePromise<T> = T | Promise<T>;

/** An authorization rule. Returns `true` to allow access, or `false` or an `Error` to deny it. */
export type AuthRule<Parent = any, Context = any, Args = any> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo
) => MaybePromise<boolean | Error>;

// Adds a typed `authorize` option to fields and object types of every builder in this program
declare module '@gql.tada/server' {
  interface FieldPluginOptions<Parent, Context, Args> {
    /** The field's authorization rule, which replaces its type's rule. Requires `authPlugin()`.
     * `true` always allows access, and `false` always denies it.
     */
    authorize?: AuthRule<Parent, Context, Args> | boolean;
  }

  interface TypePluginOptions<Shape, Context> {
    /** The rule of this type's fields without their own rule. Requires `authPlugin()`. */
    authorize?: AuthRule<Shape, Context, unknown> | boolean;
  }
}

export interface AuthPluginOptions {
  /** Whether fields without a field or type rule are allowed or denied. Defaults to `'allow'`. */
  default?: 'allow' | 'deny';
  /** Creates the error for a denied field. */
  createError?(info: GraphQLResolveInfo): GraphQLError;
}

const isPromise = (value: any): value is Promise<unknown> =>
  !!value && typeof value.then === 'function';

const then = <T, R>(
  value: MaybePromise<T>,
  next: (value: T) => MaybePromise<R>
): MaybePromise<R> => (isPromise(value) ? (value as Promise<T>).then(next) : next(value as T));

type Rule = AuthRule<unknown, unknown, unknown>;

// Blocks inference, so that rules inside an `authorize` option take their types from the field
type NoInfer<T> = [T][T extends any ? 0 : never];
type ContextualRule<Parent, Context, Args> = AuthRule<
  NoInfer<Parent>,
  NoInfer<Context>,
  NoInfer<Args>
>;

/** Allows access if all rules allow it. Rules run in order and stop at the first denial. */
export function and<Parent, Context, Args>(
  ...rules: readonly ContextualRule<Parent, Context, Args>[]
): AuthRule<Parent, Context, Args>;
export function and<Parent, Context, Args>(
  ...rules: readonly AuthRule<Parent, Context, Args>[]
): AuthRule<Parent, Context, Args>;
export function and<Parent, Context, Args>(
  ...rules: readonly AuthRule<Parent, Context, Args>[]
): AuthRule<Parent, Context, Args> {
  return (parent, args, context, info) => {
    const run = (index: number): MaybePromise<boolean | Error> =>
      index >= rules.length
        ? true
        : then(rules[index](parent, args, context, info), (result) =>
            result === true ? run(index + 1) : result
          );
    return run(0);
  };
}

/** Allows access if any rule allows it. Rules run in order and stop at the first that allows it. */
export function or<Parent, Context, Args>(
  ...rules: readonly ContextualRule<Parent, Context, Args>[]
): AuthRule<Parent, Context, Args>;
export function or<Parent, Context, Args>(
  ...rules: readonly AuthRule<Parent, Context, Args>[]
): AuthRule<Parent, Context, Args>;
export function or<Parent, Context, Args>(
  ...rules: readonly AuthRule<Parent, Context, Args>[]
): AuthRule<Parent, Context, Args> {
  return (parent, args, context, info) => {
    const run = (index: number, denial: boolean | Error): MaybePromise<boolean | Error> =>
      index >= rules.length
        ? denial
        : then(rules[index](parent, args, context, info), (result) =>
            result === true ? true : run(index + 1, result)
          );
    return run(0, false);
  };
}

/** Allows access if the rule denies it. */
export function not<Parent, Context, Args>(
  rule: ContextualRule<Parent, Context, Args>
): AuthRule<Parent, Context, Args>;
export function not<Parent, Context, Args>(
  rule: AuthRule<Parent, Context, Args>
): AuthRule<Parent, Context, Args>;
export function not<Parent, Context, Args>(
  rule: AuthRule<Parent, Context, Args>
): AuthRule<Parent, Context, Args> {
  return (parent, args, context, info) =>
    then(rule(parent, args, context, info), (result) => result !== true);
}

const coordinate = (info: GraphQLResolveInfo) => `${info.parentType.name}.${info.fieldName}`;

const defaultError = (info: GraphQLResolveInfo) =>
  new GraphQLError(`Not authorized to access "${coordinate(info)}".`, {
    extensions: { code: 'FORBIDDEN' },
  });

/** Checks `authorize` rules of fields and object types before their resolvers run.
 *
 * @remarks
 * A field's rule replaces its type's rule. Subscription root fields are checked once,
 * before the subscription starts. A denied field resolves to an error, which `graphql`
 * propagates to the nearest nullable parent, as with any other field error.
 */
export function authPlugin(options: AuthPluginOptions = {}): SchemaPlugin {
  const createError = options.createError || defaultError;
  const fallback = options.default === 'deny' ? false : true;

  const ruleOf = (field: PluginField): Rule | boolean => {
    let rule = field.options.authorize;
    if (rule === undefined) rule = field.typeOptions.authorize;
    if (rule === undefined) rule = fallback;
    if (typeof rule !== 'boolean' && typeof rule !== 'function')
      throw new TypeError(
        `The "authorize" option of "${field.typeName}.${field.fieldName}" must be a function or a boolean.`
      );
    return rule as Rule | boolean;
  };

  const guard = (field: PluginField, next: FieldResolver): FieldResolver | void => {
    const rule = ruleOf(field);
    if (rule === true) return;
    return (source, args, context, info) => {
      const deny = (result: boolean | Error) => {
        if (result instanceof GraphQLError) return result;
        if (result instanceof Error)
          return new GraphQLError(result.message, {
            originalError: result,
            extensions: { code: 'FORBIDDEN' },
          });
        return createError(info);
      };
      if (rule === false) throw deny(false);
      return then(rule(source, args, context, info), (result) => {
        if (result !== true) throw deny(result);
        return next(source, args, context, info);
      });
    };
  };

  return {
    name: 'auth',
    fieldOptions: ['authorize'],
    typeOptions: ['authorize'],
    wrapResolve: (next, field) =>
      field.operation === 'subscription' ? undefined : guard(field, next),
    wrapSubscribe: (next, field) => guard(field, next),
  };
}
