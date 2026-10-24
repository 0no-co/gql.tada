/* eslint-disable no-console */
import type { SchemaPlugin } from '@gql.tada/server';

declare module '@gql.tada/server' {
  interface FieldPluginOptions<Parent, Context, Args> {
    /** Logs how long the field's resolver takes. Requires `tracePlugin`. */
    trace?: boolean;
  }
}

/** Logs how long the resolvers of fields with `trace: true` take. */
export const tracePlugin: SchemaPlugin = {
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
