import type { Kind } from '@0no-co/graphql.web';
import type { DocumentNodeLike } from './parser';

type _getFragmentMapRec<Definitions> = Definitions extends readonly [
  infer Definition,
  ...infer Rest,
]
  ? (Definition extends { kind: Kind.FRAGMENT_DEFINITION; name: any }
      ? { [Name in Definition['name']['value']]: Definition }
      : {}) &
      _getFragmentMapRec<Rest>
  : {};

export type getFragmentMap<Document extends DocumentNodeLike> = _getFragmentMapRec<
  Document['definitions']
>;
