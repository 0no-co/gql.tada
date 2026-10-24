// NOTE: This module is also published as `@gql.tada/internal/introspection`, which has to
// stay free of `typescript` imports, since `typescript@7` doesn't expose a compiler API
export { minifyIntrospectionQuery as minifyIntrospection } from './minify';
export { preprocessIntrospection } from './preprocess';
export { introspectSchema, parseIntrospectionJSON } from './schema';
export * from './output';
export type { IntrospectionResult } from '../loaders/types';
