import type { Kind, DocumentNode } from '@0no-co/graphql.web';
import type { DocumentNodeLike } from './parser';
import type { obj } from './utils';

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

  const definition: unique symbol;
  export type definition = typeof definition;

  const ref: unique symbol;
  export type ref = typeof ref;
}

interface FragmentDefDecorationLike {
  readonly [$tada.ref]: symbol;
  kind: Kind.FRAGMENT_DEFINITION;
  name: any;
  typeCondition: any;
}

interface DocumentDefDecorationLike extends DocumentNode {
  [$tada.definition]?: FragmentDefDecorationLike;
}

type decorateFragmentDef<Document extends DocumentNodeLike> = Document['definitions'][0] extends {
  kind: Kind.FRAGMENT_DEFINITION;
  name: any;
}
  ? {
      // NOTE: This is a shortened definition for readability in LSP hovers
      kind: Kind.FRAGMENT_DEFINITION;
      name: Document['definitions'][0]['name'];
      typeCondition: Document['definitions'][0]['typeCondition'];
      readonly [$tada.ref]: unique symbol;
    }
  : never;

type getFragmentsOfDocumentsRec<Documents> = Documents extends readonly [
  infer Document,
  ...infer Rest,
]
  ? (Document extends { [$tada.definition]?: any }
      ? Exclude<Document[$tada.definition], undefined> extends infer FragmentDef extends {
          kind: Kind.FRAGMENT_DEFINITION;
          name: any;
          typeCondition: any;
        }
        ? { [Name in FragmentDef['name']['value']]: FragmentDef }
        : {}
      : {}) &
      getFragmentsOfDocumentsRec<Rest>
  : {};

type makeFragmentRef<Definition extends FragmentDefDecorationLike> = obj<{
  [$tada.fragmentRefs]: {
    [Name in Definition['name']['value']]: Definition[$tada.ref];
  };
}>;

type makeUndefinedFragmentRef<FragmentName extends string> = {
  [$tada.fragmentRefs]: {
    [Name in FragmentName]: 'Undefined Fragment';
  };
};

type makeDefinitionDecoration<Definition> = {
  [$tada.definition]?: Definition extends DocumentDefDecorationLike[$tada.definition]
    ? Definition
    : never;
};

export type {
  $tada,
  decorateFragmentDef,
  getFragmentsOfDocumentsRec,
  makeDefinitionDecoration,
  makeFragmentRef,
  makeUndefinedFragmentRef,
  FragmentDefDecorationLike,
  DocumentDefDecorationLike,
};
