import type { Kind } from '@0no-co/graphql.web';

type _FragmentMapContinue<Definitions> = Definitions extends readonly [
  infer Definition,
  ...infer Rest
]
  ? (Definition extends { kind: Kind.FRAGMENT_DEFINITION; name: any }
      ? { [Name in Definition['name']['value']]: Definition }
      : {}) &
      _FragmentMapContinue<Rest>
  : {};

export type FragmentMap<Document extends { kind: Kind.DOCUMENT; definitions: any[] }> =
  _FragmentMapContinue<Document['definitions']>;
