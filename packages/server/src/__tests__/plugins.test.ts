import { describe, it, expect } from 'vitest';
import {
  graphql,
  subscribe,
  parse,
  GraphQLDirective,
  DirectiveLocation,
  type GraphQLSchema,
} from 'graphql';

import type { SchemaPlugin, PluginField } from '../plugin';
import { initSchemaBuilder } from '../builder';

declare module '@gql.tada/server' {
  interface FieldPluginOptions<Parent, Context, Args> {
    cost?: number;
  }
}

type Context = { log: string[] };

const run = (schema: GraphQLSchema, source: string, contextValue: Context = { log: [] }) =>
  graphql({ schema, source, contextValue });

const tracer = (name: string, log: string[]): SchemaPlugin<Context> => ({
  name,
  wrapResolve: (next, field) => (source, args, ctx, info) => {
    log.push(`${name}:before:${field.typeName}.${field.fieldName}`);
    const result = next(source, args, ctx, info);
    log.push(`${name}:after:${field.typeName}.${field.fieldName}`);
    return result;
  },
});

const buildSchema = (plugins: readonly SchemaPlugin<Context>[]) => {
  const t = initSchemaBuilder<{ context: Context }>({ plugins });
  const User = t.objectRef<{ name: string }>()('User');
  const UserType = t.object(User, {
    fields: (f) => ({ name: f.field({ type: t.nonNull(t.String) }) }),
  });
  const Query = t.object(t.objectRef()('Query'), {
    fields: (f) => ({
      user: f.field({ type: t.nonNull(User), resolve: () => ({ name: 'Phil' }) }),
      later: f.field({ type: t.String, resolve: async () => 'later' }),
    }),
  });
  return t.schema({ query: Query, types: [UserType] });
};

describe('plugins', () => {
  it('wraps resolvers and default resolvers, with the first plugin outermost', async () => {
    const log: string[] = [];
    const schema = buildSchema([tracer('a', log), tracer('b', log)]);
    const result = await run(schema, `{ user { name } }`);
    expect(result).toEqual({ data: { user: { name: 'Phil' } } });
    expect(log).toEqual([
      'a:before:Query.user',
      'b:before:Query.user',
      'b:after:Query.user',
      'a:after:Query.user',
      'a:before:User.name',
      'b:before:User.name',
      'b:after:User.name',
      'a:after:User.name',
    ]);
  });

  it('lets wrappers short-circuit and transform results, including async ones', async () => {
    const schema = buildSchema([
      {
        name: 'upper',
        wrapResolve: (next) => async (source, args, ctx, info) => {
          const value = await next(source, args, ctx, info);
          return typeof value === 'string' ? value.toUpperCase() : value;
        },
      },
      {
        name: 'stub',
        wrapResolve: (next, field) => (field.fieldName === 'name' ? () => 'Stubbed' : next),
      },
    ]);
    const result = await run(schema, `{ user { name } later }`);
    expect(result).toEqual({ data: { user: { name: 'STUBBED' }, later: 'LATER' } });
  });

  it('passes field and type options, the operation, and the typed context to plugins', async () => {
    const fields: PluginField[] = [];
    const plugin: SchemaPlugin<Context> = {
      name: 'cost',
      fieldOptions: ['cost'],
      typeOptions: ['authorize'],
      wrapResolve: (next, field) => {
        fields.push(field);
        return (source, args, ctx, info) => {
          ctx.log.push(`${field.fieldName}:${field.options.cost}`);
          return next(source, args, ctx, info);
        };
      },
      onField: (field) => (field.options.cost ? { extensions: { cost: field.options.cost } } : {}),
      onType: (type) => ({ extensions: { plugin: type.name } }),
    };
    const t = initSchemaBuilder<{ context: Context }>({ plugins: [plugin] });
    const Query = t.object(t.objectRef()('Query'), {
      authorize: true,
      fields: (f) => ({
        price: f.field({ type: t.Int, cost: 3, resolve: () => 1 }),
      }),
    });
    const schema = t.schema({ query: Query });
    const context: Context = { log: [] };
    expect(await run(schema, `{ price }`, context)).toEqual({ data: { price: 1 } });
    expect(context.log).toEqual(['price:3']);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      typeName: 'Query',
      fieldName: 'price',
      operation: 'query',
      typeOptions: { authorize: true },
    });
    expect(schema.getQueryType()!.getFields().price.extensions).toEqual({ cost: 3 });
    expect(schema.getQueryType()!.extensions).toEqual({ plugin: 'Query' });
  });

  it('adds directives and extensions to the schema', () => {
    const directive = new GraphQLDirective({
      name: 'cost',
      locations: [DirectiveLocation.FIELD_DEFINITION],
    });
    const schema = buildSchema([
      { name: 'schema', onSchema: () => ({ directives: [directive], extensions: { a: 1 } }) },
    ]);
    expect(schema.getDirective('cost')).toBe(directive);
    expect(schema.extensions).toEqual({ a: 1 });
  });

  it('wraps subscribe functions of subscription root fields', async () => {
    const log: string[] = [];
    const t = initSchemaBuilder<{ context: Context }>({
      plugins: [
        {
          name: 'subscribe',
          wrapSubscribe: (next, field) => (source, args, ctx, info) => {
            log.push(`subscribe:${field.operation}:${field.fieldName}`);
            return next(source, args, ctx, info);
          },
        },
      ],
    });
    const Query = t.object(t.objectRef()('Query'), {
      fields: (f) => ({ ok: f.field({ type: t.Boolean, resolve: () => true }) }),
    });
    const Subscription = t.object(t.objectRef()('Subscription'), {
      fields: (f) => ({
        tick: f.field({
          type: t.Int,
          subscribe: async function* () {
            yield 1;
          },
          resolve: (value) => value,
        }),
      }),
    });
    const schema = t.schema({ query: Query, subscription: Subscription });
    const result = await subscribe({
      schema,
      document: parse(`subscription { tick }`),
      contextValue: { log: [] },
    });
    const events: unknown[] = [];
    for await (const event of result as AsyncIterable<unknown>) events.push(event);
    expect(events).toEqual([{ data: { tick: 1 } }]);
    expect(log).toEqual(['subscribe:subscription:tick']);
  });

  it('rejects options that no registered plugin handles', () => {
    const t = initSchemaBuilder();
    const Query = t.object(t.objectRef()('Query'), {
      fields: (f) => ({ a: f.field({ type: t.Int, cost: 1, resolve: () => 1 }) }),
    });
    expect(() => t.schema({ query: Query })).toThrow(
      '"Query.a" sets an unknown option "cost". Options of plugins require passing the plugin to initSchemaBuilder({ plugins }).'
    );

    const Typed = t.object(t.objectRef()('Query'), {
      authorize: true,
      fields: (f) => ({ a: f.field({ type: t.Int, resolve: () => 1 }) }),
    });
    expect(() => t.schema({ query: Typed })).toThrow('"Query" sets an unknown option "authorize".');
  });
});
