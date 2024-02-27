export type { $tada } from './namespace';

export {
  parse,
  graphql,
  readFragment,
  maskFragments,
  unsafe_readResult,
  initGraphQLTada,
} from './api';

export type {
  setupSchema,
  parseDocument,
  AbstractSetupSchema,
  GraphQLTadaAPI,
  TadaDocumentNode,
  ResultOf,
  VariablesOf,
  FragmentOf,
} from './api';
