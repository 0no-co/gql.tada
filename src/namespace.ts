import type { Kind } from '@0no-co/graphql.web';
import type { DocumentNodeLike } from './parser';

/** Private namespace holding our symbols for markers.
 *
 * @remarks
 * Markers are used to indicate, for example, which fragments a given GraphQL document
 * is referring to or which fragments a document exposes. This ties into “fragment masking”,
 * a process by which the type of a fragment is hidden away until it’s unwrapped, to enforce
 * isolation and code-reuse.
 */
declare namespace $tada {
  const fragmentRefs: unique symbol;
  export type fragmentRefs = typeof fragmentRefs;

  const fragmentDef: unique symbol;
  export type fragmentDef = typeof fragmentDef;

  const fragmentId: unique symbol;
  export type fragmentId = typeof fragmentId;
}

type decorateDocument<Document extends DocumentNodeLike> = Document['definitions'][0] extends {
  kind: Kind.FRAGMENT_DEFINITION;
  name: any;
  typeCondition: any;
}
  ? {
      [$tada.fragmentDef]?: Document['definitions'][0] & {
        readonly [$tada.fragmentId]: unique symbol;
      };
    }
  : {};

type getFragmentsOfDocumentsRec<Documents> = Documents extends readonly [
  infer Document,
  ...infer Rest,
]
  ? (Document extends { [$tada.fragmentDef]?: any }
      ? Exclude<Document[$tada.fragmentDef], undefined> extends infer FragmentDef extends {
          kind: Kind.FRAGMENT_DEFINITION;
          name: any;
          typeCondition: any;
        }
        ? { [Name in FragmentDef['name']['value']]: FragmentDef }
        : {}
      : {}) &
      getFragmentsOfDocumentsRec<Rest>
  : {};

type FragmentDocumentNode = {
  [$tada.fragmentDef]?: {
    readonly [$tada.fragmentId]: symbol;
    kind: Kind.FRAGMENT_DEFINITION;
    name: any;
    typeCondition: any;
  };
};

export type { $tada, decorateDocument, getFragmentsOfDocumentsRec, FragmentDocumentNode };
