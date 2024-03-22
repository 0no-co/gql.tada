import type { Kind } from '@0no-co/graphql.web';
import type { DocumentNodeLike } from './parser';
import type { DocumentDecoration } from './utils';

/** Private namespace holding our symbols for markers.
 * @internal
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
  fragment: any;
  on: any;
  masked: any;
}

type isMaskedRec<Directives extends readonly unknown[] | undefined> = Directives extends readonly [
  infer Directive,
  ...infer Rest,
]
  ? Directive extends { kind: Kind.DIRECTIVE; name: any }
    ? Directive['name']['value'] extends '_unmask'
      ? false
      : isMaskedRec<Rest>
    : isMaskedRec<Rest>
  : true;

type decorateFragmentDef<
  Document extends DocumentNodeLike,
  isMaskingDisabled = false,
> = Document['definitions'][0] extends {
  kind: Kind.FRAGMENT_DEFINITION;
  name: any;
}
  ? {
      fragment: Document['definitions'][0]['name']['value'];
      on: Document['definitions'][0]['typeCondition']['name']['value'];
      masked: isMaskingDisabled extends true
        ? false
        : isMaskedRec<Document['definitions'][0]['directives']>;
    }
  : void;

type getFragmentsOfDocumentsRec<Documents, Fragments = {}> = Documents extends readonly [
  infer Document,
  ...infer Rest,
]
  ? getFragmentsOfDocumentsRec<
      Rest,
      (Document extends { [$tada.definition]?: any }
        ? Exclude<Document[$tada.definition], undefined> extends infer Definition extends
            FragmentDefDecorationLike
          ? {
              [Name in Definition['fragment']]: {
                kind: Kind.FRAGMENT_DEFINITION;
                name: {
                  kind: Kind.NAME;
                  value: Definition['fragment'];
                };
                typeCondition: {
                  kind: Kind.NAMED_TYPE;
                  name: {
                    kind: Kind.NAME;
                    value: Definition['on'];
                  };
                };
                [$tada.ref]: makeFragmentRef<Document>;
              };
            }
          : {}
        : {}) &
        Fragments
    >
  : Fragments;

type makeFragmentRef<Document> = Document extends { [$tada.definition]?: infer Definition }
  ? Definition extends FragmentDefDecorationLike
    ? Definition['masked'] extends false
      ? Document extends DocumentDecoration<infer Result, any>
        ? Result
        : {
            [$tada.fragmentRefs]: {
              [Name in Definition['fragment']]: Definition['on'];
            };
          }
      : {
          [$tada.fragmentRefs]: {
            [Name in Definition['fragment']]: Definition['on'];
          };
        }
    : never
  : never;

type omitFragmentRefsRec<Data> = Data extends readonly (infer Value)[]
  ? readonly omitFragmentRefsRec<Value>[]
  : Data extends null
    ? null
    : Data extends undefined
      ? undefined
      : Data extends {}
        ? {
            [Key in Exclude<keyof Data, $tada.fragmentRefs>]: omitFragmentRefsRec<Data[Key]>;
          }
        : Data;

interface makeUndefinedFragmentRef<FragmentName extends string> {
  [$tada.fragmentRefs]: {
    [Name in FragmentName]: 'Undefined Fragment';
  };
}

interface DefinitionDecoration<Definition = FragmentDefDecorationLike> {
  [$tada.definition]?: Definition;
}

interface FragmentShape<Result = any> extends DocumentDecoration<Result>, DefinitionDecoration {}

export type {
  $tada,
  decorateFragmentDef,
  getFragmentsOfDocumentsRec,
  omitFragmentRefsRec,
  makeFragmentRef,
  makeUndefinedFragmentRef,
  DefinitionDecoration,
  FragmentDefDecorationLike,
  FragmentShape,
};
