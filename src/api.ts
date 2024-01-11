import type { DocumentNode, DefinitionNode } from '@0no-co/graphql.web';
import { Kind, parse as _parse } from '@0no-co/graphql.web';

import type {
  IntrospectionQuery,
  ScalarsLike,
  IntrospectionLikeType,
  mapIntrospection,
} from './introspection';

import type {
  FragmentDefDecorationLike,
  DocumentDefDecorationLike,
  getFragmentsOfDocumentsRec,
  makeFragmentDefDecoration,
  decorateFragmentDef,
  makeFragmentRef,
  $tada,
} from './namespace';

import type { getDocumentType } from './selection';
import type { getVariablesType } from './variables';
import type { parseDocument, DocumentNodeLike } from './parser';
import type { stringLiteral, matchOr, DocumentDecoration } from './utils';

interface AbstractSetupSchema {
  introspection: IntrospectionQuery;
  scalars: ScalarsLike;
}

interface setupSchema extends AbstractSetupSchema {
  /*empty*/
}

type Schema = mapIntrospection<
  matchOr<IntrospectionQuery, setupSchema['introspection'], never>,
  matchOr<ScalarsLike, setupSchema['scalars'], {}>
>;

function parse<const In extends stringLiteral<In>>(input: In): parseDocument<In> {
  return _parse(input) as any;
}

type getDocumentNode<
  Document extends DocumentNodeLike,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any } = {},
> = getDocumentType<Document, Introspection, Fragments> extends infer Result
  ? Result extends never
    ? never
    : TadaDocumentNode<
        Result,
        getVariablesType<Document, Introspection>,
        decorateFragmentDef<Document>
      >
  : never;

function graphql<
  const In extends stringLiteral<In>,
  const Fragments extends readonly [...DocumentDefDecorationLike[]],
>(
  input: In,
  fragments?: Fragments
): getDocumentNode<parseDocument<In>, Schema, getFragmentsOfDocumentsRec<Fragments>> {
  const definitions = _parse(input).definitions as DefinitionNode[];
  const seen = new Set<unknown>();
  for (const document of fragments || []) {
    for (const definition of document.definitions) {
      if (definition.kind === Kind.FRAGMENT_DEFINITION && !seen.has(definition)) {
        definitions.push(definition);
        seen.add(definition);
      }
    }
  }
  return { kind: Kind.DOCUMENT, definitions: [...definitions] } as any;
}

/** A GraphQL `DocumentNode` with attached generics for its result data and variables.
 *
 * @remarks
 * A GraphQL {@link DocumentNode} defines both the variables it accepts on request and the `data`
 * shape it delivers on a response in the GraphQL query language.
 *
 * To bridge the gap to TypeScript, tools may be used to generate TypeScript types that define the shape
 * of `data` and `variables` ahead of time. These types are then attached to GraphQL documents using this
 * `TypedDocumentNode` type.
 *
 * Using a `DocumentNode` that is typed like this will cause any `urql` API to type its input `variables`
 * and resulting `data` using the types provided.
 *
 * @privateRemarks
 * For compatibility reasons this type has been copied and internalized from:
 * https://github.com/dotansimha/graphql-typed-document-node/blob/3711b12/packages/core/src/index.ts#L3-L10
 *
 * @see {@link https://github.com/dotansimha/graphql-typed-document-node} for more information.
 */
interface TadaDocumentNode<
  Result = { [key: string]: any },
  Variables = { [key: string]: any },
  Decoration = never,
> extends DocumentNode,
    DocumentDecoration<Result, Variables>,
    makeFragmentDefDecoration<Decoration> {}

type ResultOf<Document> = Document extends DocumentDecoration<infer Result, infer _>
  ? Result
  : never;

type VariablesOf<Document> = Document extends DocumentDecoration<infer _, infer Variables>
  ? Variables
  : never;

type FragmentOf<Document extends DocumentDefDecorationLike> = Exclude<
  Document[$tada.fragmentDef],
  undefined
> extends infer FragmentDef extends FragmentDefDecorationLike
  ? makeFragmentRef<FragmentDef>
  : never;

type mirrorFragmentTypeRec<Fragment, Data> = Fragment extends readonly (infer Value)[]
  ? mirrorFragmentTypeRec<Value, Data>[]
  : Fragment extends null
    ? null
    : Fragment extends undefined
      ? undefined
      : Data;

type fragmentOfTypeRec<Document extends DocumentDefDecorationLike> =
  | readonly fragmentOfTypeRec<Document>[]
  | FragmentOf<Document>
  | undefined
  | null;

function readFragment<
  const Document extends DocumentDefDecorationLike,
  const Fragment extends fragmentOfTypeRec<Document>,
  const Data,
>(
  _document: DocumentDecoration<Data, any> & Document,
  fragment: Fragment
): fragmentOfTypeRec<Document> extends Fragment ? unknown : mirrorFragmentTypeRec<Fragment, Data> {
  return fragment as any;
}

export { parse, graphql, readFragment };
export type { setupSchema, parseDocument, TadaDocumentNode, ResultOf, VariablesOf, FragmentOf };
