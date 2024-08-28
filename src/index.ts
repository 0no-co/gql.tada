export {
  parse,
  graphql,
  readFragment,
  maskFragments,
  unsafe_readResult,
  initGraphQLTada,
} from './api';

// A `print` function compatible with `parse` exported above
export { print } from '@0no-co/graphql.web';

export type {
  setupCache,
  setupSchema,
  parseDocument,
  AbstractSetupSchema,
  AbstractSetupCache,
  GraphQLTadaAPI,
  TadaDocumentNode,
  TadaPersistedDocumentNode,
  ResultOf,
  VariablesOf,
  FragmentOf,
} from './api';

export type { DocumentDecoration } from './utils';

// NOTE: This must be exported for `isolatedModules: true`
export type { $tada } from './namespace';
export type { mapType as __mapType } from './introspection';
