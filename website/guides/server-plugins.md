---
title: Server Plugins
description: How to write plugins for @gql.tada/server, with recipes for authorization and error masking.
---

# Writing Server Plugins <Badge type="warning" text="experimental" />

<section>
  Plugins extend the <code>@gql.tada/server</code> schema builder.
  They wrap resolvers, add extensions and directives, and add typed
  options to fields and types. This page shows how to write them,
  with authorization and error masking as recipes.
</section>

`@gql.tada/server` ships the plugin API, but no plugins. The recipes on this page are
starting points that you copy into your codebase and adapt. Complete versions, with tests,
are in [`examples/example-server/src/plugins`](https://github.com/0no-co/gql.tada/tree/main/examples/example-server/src/plugins).

Plugins can't change types or arguments, so the schema's type, and with it the types
of your documents, are the same with or without them.

---

## Passing plugins

Plugins are passed to `initSchemaBuilder()`, and apply to every type the builder defines.

```ts [src/schema/builder.ts]
import { initSchemaBuilder } from '@gql.tada/server';
import { authPlugin } from './plugins/auth';
import { maskErrorsPlugin } from './plugins/maskErrors';

export const t = initSchemaBuilder<{ context: Context }>({
  plugins: [maskErrorsPlugin(), authPlugin()],
});
```

Plugins run in the order they're passed, so the first plugin's resolver wrapper is the
outermost. Here, `maskErrorsPlugin()` comes first to also mask errors of the other plugins.

---

## Writing a plugin

A plugin is an object with a `name` and any of the following hooks, which run once per
field or type when the schema is created:

| Hook                         | Description                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `wrapResolve(next, field)`   | Returns a resolver that wraps `next`, or nothing. Fields without a resolver pass `graphql`'s default one. |
| `wrapSubscribe(next, field)` | Returns a `subscribe` function that wraps `next`, for subscription root fields.                           |
| `onField(field)`             | Returns `extensions` to add to the field.                                                                 |
| `onType(type)`               | Returns `extensions` to add to an object type.                                                            |
| `onSchema()`                 | Returns `directives` and `extensions` to add to the schema.                                               |

`field` describes the field as a `PluginField`: its `typeName`, `fieldName`, the root
`operation` it belongs to, if any, its `options`, and the plugin options of its type,
`typeOptions`. `type` is a `PluginType`, with the type's `name` and its plugin `options`.
Resolvers and `subscribe` functions are typed as `FieldResolver`. Hooks apply to fields
of object types, but not of interfaces.

A wrapper may run code before and after `next`, change its result, or skip it, for example
to return a cached value. This plugin logs how long resolvers take:

```ts [src/plugins/trace.ts]
import type { SchemaPlugin } from '@gql.tada/server';

export const tracePlugin: SchemaPlugin = {
  name: 'trace',
  wrapResolve: (next, field) => async (source, args, ctx, info) => {
    const start = performance.now();
    try {
      return await next(source, args, ctx, info);
    } finally {
      console.log(`${field.typeName}.${field.fieldName}: ${performance.now() - start}ms`);
    }
  },
};
```

Typing a plugin as `SchemaPlugin<Context>` types the context that its wrappers receive,
and only lets it be passed to builders with a matching context type.

### Adding options

Plugins add options to fields and object types by merging them into the
`FieldPluginOptions` and `TypePluginOptions` interfaces of `@gql.tada/server`.
Their type parameters give options the types of the field's parent value, the
builder's context, and the field's arguments, or of the object type's backing type
and the context. Merged declarations must use the same type parameter names.

```ts [src/plugins/trace.ts]
declare module '@gql.tada/server' {
  interface FieldPluginOptions<Parent, Context, Args> {
    trace?: boolean;
  }
}

export const tracePlugin: SchemaPlugin = {
  name: 'trace',
  fieldOptions: ['trace'], // [!code focus]
  wrapResolve: (next, field) => (field.options.trace ? traced(next, field) : undefined),
};
```

A plugin lists the options it reads in `fieldOptions` and `typeOptions`. Its hooks see
merged options with their declared types on `field.options`, `field.typeOptions`, and
`type.options`. These aren't validated at runtime, so check values that a mistyped
call could have set.

Merged options are available on every builder in your program, whether or not it uses
the plugin. The schema therefore throws when it's created if a field or type sets an
option that none of its builder's plugins list.

---

## Recipe: Masking errors

Resolvers may throw errors that contain details clients shouldn't see. This plugin
replaces errors that resolvers throw, return, or reject with, with a generic error.
A `GraphQLError` is treated as intentional, and passes through unchanged.

```ts [src/plugins/maskErrors.ts]
import { GraphQLError, type GraphQLResolveInfo } from 'graphql';
import type { FieldResolver, SchemaPlugin } from '@gql.tada/server';

export function maskErrorsPlugin(
  onError?: (error: unknown, info: GraphQLResolveInfo) => void
): SchemaPlugin {
  const mask = (error: unknown, info: GraphQLResolveInfo) => {
    if (error instanceof GraphQLError) return error;
    if (onError) onError(error, info);
    return new GraphQLError('Unexpected error.', {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
  };

  const wrap =
    (next: FieldResolver): FieldResolver =>
    async (source, args, ctx, info) => {
      let result: unknown;
      try {
        result = await next(source, args, ctx, info);
      } catch (error) {
        throw mask(error, info);
      }
      return result instanceof Error ? mask(result, info) : result;
    };

  return { name: 'maskErrors', wrapResolve: wrap, wrapSubscribe: wrap };
}
```

Wrapping `subscribe` masks errors of starting a subscription, but not errors of the
events it emits. The example's version also keeps synchronous resolvers synchronous.

---

## Recipe: Authorization

This plugin adds an `authorize` option to fields and object types. A rule receives the
field's parent value, its arguments, the context, and the resolve info, typed by the
field. It returns `true` to allow access, or `false` or an `Error` to deny it, and may
return a promise.

```ts [src/plugins/auth.ts]
import { GraphQLError, type GraphQLResolveInfo } from 'graphql';
import type { FieldResolver, PluginField, SchemaPlugin } from '@gql.tada/server';

export type AuthRule<Parent = any, Context = any, Args = any> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo
) => boolean | Error | Promise<boolean | Error>;

declare module '@gql.tada/server' {
  interface FieldPluginOptions<Parent, Context, Args> {
    authorize?: AuthRule<Parent, Context, Args> | boolean;
  }
  interface TypePluginOptions<Shape, Context> {
    // Arguments differ between the type's fields
    authorize?: AuthRule<Shape, Context, unknown> | boolean;
  }
}

const deny = (result: boolean | Error, info: GraphQLResolveInfo) =>
  result instanceof GraphQLError
    ? result
    : new GraphQLError(
        result instanceof Error ? result.message : `Not authorized to access "${info.fieldName}".`,
        { extensions: { code: 'FORBIDDEN' } }
      );

export function authPlugin(): SchemaPlugin {
  const guard = (field: PluginField, next: FieldResolver): FieldResolver | void => {
    // A field's rule replaces its type's rule
    const rule = field.options.authorize ?? field.typeOptions.authorize ?? true;
    if (rule === true) return;
    return async (source, args, ctx, info) => {
      const result = rule === false ? false : await rule(source, args, ctx, info);
      if (result !== true) throw deny(result, info);
      return next(source, args, ctx, info);
    };
  };

  return {
    name: 'auth',
    fieldOptions: ['authorize'],
    typeOptions: ['authorize'],
    // Subscription root fields are checked once, when the subscription starts
    wrapResolve: (next, field) =>
      field.operation === 'subscription' ? undefined : guard(field, next),
    wrapSubscribe: (next, field) => guard(field, next),
  };
}
```

With the plugin passed to the builder, rules are typed by each field:

```ts [src/schema/todos.ts]
const signedIn = (_parent: unknown, _args: unknown, ctx: Context) =>
  ctx.viewerId != null || new Error('Sign in first.');

export const TodoMutations = t.object(Mutation, {
  authorize: signedIn,
  fields: (f) => ({
    toggleTodo: f.field({
      type: Todo,
      args: { id: t.nonNull(t.ID) },
      // `args` is typed as `{ id: string }`
      authorize: (_, args, ctx) => ctx.db.todos.get(args.id)?.authorId === ctx.viewerId,
      resolve: (_, args, ctx) => ctx.db.toggleTodo(args.id),
    }),
  }),
});
```

A denied field resolves to an error with the code `FORBIDDEN`, and like any other field
error, `null` propagates to its nearest nullable parent.

The example's version adds a default policy for fields without a rule, custom errors,
and `and()`, `or()`, and `not()` to compose rules. Composing generic rules has one
subtlety: TypeScript infers a function's type parameters from its arguments before
the `authorize` option it's passed to. The example's helpers block inference from their
arguments with an overload, so that inline rules inside `and(signedIn, (_, args) => ...)`
are still typed by the field.

---

## Other plugins

The same hooks support other plugins, for example:

- **Tracing:** `wrapResolve` receives the resolve info of every call, including the path, to report spans to a tracer.
- **Caching rule results:** a wrapper can store results per request with [`createContextCache()`](/guides/schema-builder#per-request-values), keyed by the context.
- **Cost analysis:** a `cost` option and `onField` can add each field's cost to its `extensions`, for a validation rule to read.
