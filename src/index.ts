export {
  parse,
  print,
  graphql,
  readFragment,
  maskFragments,
  unsafe_readResult,
  initGraphQLTada,
} from './api';

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
