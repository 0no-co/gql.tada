---
title: Server Plugins
description: How to add authorization, error masking, and your own plugins to a gql.tada/server schema.
---

# Server Plugins

<section>
  Plugins extend the <code>gql.tada/server</code> schema builder.
  They wrap resolvers, and add typed options to fields and types.
  <code>gql.tada/server</code> comes with plugins for authorization
  and for masking errors.
</section>

Plugins are passed to `initSchemaBuilder()`, and apply to every type the builder
defines. They can't change types or arguments, so the schema's type, and with it
the types of your documents, are the same with or without them.

```ts [src/schema/builder.ts]
import { initSchemaBuilder, authPlugin, maskErrorsPlugin } from 'gql.tada/server';

export const t = initSchemaBuilder<{ context: Context }>({
  plugins: [maskErrorsPlugin(), authPlugin()],
});
```

Plugins run in the order they're passed, so the first plugin's resolver wrapper
is the outermost. Pass `maskErrorsPlugin()` first to also mask errors of the
other plugins.

---

## Authorization

`authPlugin()` checks rules, which you set with the `authorize` option of fields
and object types. A rule receives the field's parent value, its arguments, the
context, and the resolve info, typed by the field. It returns `true` to allow
access, or `false` or an `Error` to deny it, and may return a promise.

```ts [src/schema/todos.ts]
import { and } from 'gql.tada/server';

const signedIn = (_parent: unknown, _args: unknown, ctx: Context) =>
  ctx.viewerId != null || new Error('Sign in first.');

export const TodoMutations = t.object(Mutation, {
  // Applies to all fields of `Mutation` without their own rule
  authorize: signedIn,
  fields: (f) => ({
    createTodo: f.field({
      type: t.nonNull(Todo),
      args: { text: t.nonNull(t.String) },
      resolve: (_, args, ctx) => ctx.db.createTodo(args.text, ctx.viewerId!),
    }),
    toggleTodo: f.field({
      type: Todo,
      args: { id: t.nonNull(t.ID) },
      // A field's rule replaces its type's rule
      authorize: and(
        signedIn,
        (_, args, ctx) => ctx.db.todos.get(args.id)?.authorId === ctx.viewerId
      ),
      resolve: (_, args, ctx) => ctx.db.toggleTodo(args.id),
    }),
  }),
});
```

Each field is checked against the first rule that applies to it:

1. The field's own `authorize` option.
2. The `authorize` option of its object type, which may be set by one of the type's definitions.
3. The plugin's `default` option, which is `'allow'` unless it's set to `'deny'`.

`true` and `false` may be passed in place of rules, e.g. to make a field public
when its type or the default denies access.

Rules run before the field's resolver. A denied field resolves to an error with the
code `FORBIDDEN` in its `extensions`, and like any other field error, `null` propagates
to its nearest nullable parent. A rule that returns an `Error` sets the error's message.
The `createError` option creates errors for rules that return `false`:

```ts
authPlugin({
  default: 'deny',
  createError: (info) =>
    new GraphQLError(`You can't access ${info.parentType.name}.${info.fieldName}.`, {
      extensions: { code: 'FORBIDDEN' },
    }),
});
```

Subscription root fields are checked once, before the subscription starts.
Events are then resolved without checking the rule again.

### Composing rules

| Function        | Description                                                               |
| --------------- | ------------------------------------------------------------------------- |
| `and(...rules)` | Allows access if all rules allow it. Stops at the first rule denying it.  |
| `or(...rules)`  | Allows access if any rule allows it. Stops at the first rule allowing it. |
| `not(rule)`     | Allows access if the rule denies it.                                      |

Composed rules stay synchronous when all their rules are synchronous. Inside an
`authorize` option, inline rules are typed by the field, even when they're composed
with rules that are typed separately. Outside of one, a composed rule's types are
inferred from the rules you pass it. Reusable rules may be typed with `AuthRule`:

```ts
import type { AuthRule } from 'gql.tada/server';

const isAdmin: AuthRule<unknown, Context> = (_parent, _args, ctx) => ctx.role === 'admin';
```

---

## Masking errors

Resolvers may throw errors that contain details clients shouldn't see.
`maskErrorsPlugin()` replaces errors that resolvers throw, return, or reject with,
with an error that has the message `Unexpected error.` and the code `INTERNAL_SERVER_ERROR`.
A `GraphQLError` is treated as intentional, and passes through unchanged.

```ts
maskErrorsPlugin({
  message: 'Something went wrong.',
  onError: (error, info) => logger.error(error, { field: info.fieldName }),
});
```

`onError` receives each masked error, for example to log it. The plugin also masks errors
of `subscribe` functions, but not errors of events that a subscription emits.

---

## Writing a plugin

A plugin is an object with a `name` and any of the following hooks, which run
once per field or type when the schema is created:

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

A wrapper may run code before and after `next`, change its result, or skip
it, for example to return a cached value. This plugin logs slow resolvers:

```ts [src/schema/plugins.ts]
import type { SchemaPlugin } from 'gql.tada/server';

export const tracePlugin: SchemaPlugin<Context> = {
  name: 'trace',
  fieldOptions: ['trace'],
  wrapResolve: (next, field) =>
    field.options.trace
      ? async (source, args, ctx, info) => {
          const start = performance.now();
          try {
            return await next(source, args, ctx, info);
          } finally {
            console.log(`${field.typeName}.${field.fieldName}: ${performance.now() - start}ms`);
          }
        }
      : undefined,
};
```

Typing a plugin as `SchemaPlugin<Context>` types the context that its wrappers receive,
and only lets it be passed to builders with the same context type.

### Adding options

Plugins add options to fields and object types by merging them into the
`FieldPluginOptions` and `TypePluginOptions` interfaces. Their type parameters
give options access to the types of the field's parent, context, and arguments,
or of the object type's backing type and context.

```ts [src/schema/plugins.ts]
declare module 'gql.tada/server' {
  interface FieldPluginOptions<Parent, Context, Args> {
    trace?: boolean;
  }
}
```

A plugin lists the options it reads in `fieldOptions` and `typeOptions`.
Since merged options are available on every builder, the schema throws when it's
created if a field or type sets an option that none of its builder's plugins list.
