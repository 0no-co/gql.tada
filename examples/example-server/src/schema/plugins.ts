/* eslint-disable no-console */
import { authPlugin, maskErrorsPlugin, type AuthRule, type SchemaPlugin } from 'gql.tada/server';
import type { Context } from '../db.ts';

// Adds a typed `trace` option to every field, which only `tracePlugin` reads
declare module 'gql.tada/server' {
  interface FieldPluginOptions<Parent, Context, Args> {
    trace?: boolean;
  }
}

/** Logs how long the resolvers of fields with `trace: true` take. */
const tracePlugin: SchemaPlugin<Context> = {
  name: 'trace',
  fieldOptions: ['trace'],
  wrapResolve: (next, field) =>
    field.options.trace
      ? async (source, args, ctx, info) => {
          const start = performance.now();
          try {
            return await next(source, args, ctx, info);
          } finally {
            const duration = (performance.now() - start).toFixed(2);
            console.log(`${field.typeName}.${field.fieldName} took ${duration}ms`);
          }
        }
      : undefined,
};

export const plugins = [
  // Passed first, so that it also masks errors of the other plugins
  maskErrorsPlugin({ onError: (error) => console.error(error) }),
  authPlugin({ default: 'allow' }),
  tracePlugin,
];

export const signedIn: AuthRule<unknown, Context> = (_parent, _args, ctx) =>
  ctx.viewerId != null || new Error('Sign in first.');
