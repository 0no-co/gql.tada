import type { DocumentNode, DefinitionNode } from '@0no-co/graphql.web';
import { Kind, parse as _parse } from '@0no-co/graphql.web';

import type {
  IntrospectionQuery,
  ScalarsLike,
  IntrospectionLikeType,
  mapIntrospection,
} from './introspection';

import type {
  decorateFragmentDef,
  getFragmentsOfDocumentsRec,
  FragmentDefDecorationLike,
  FragmentDefDecoration,
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
  In extends string,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any } = {},
> = parseDocument<In> extends infer Document extends DocumentNodeLike
  ? getDocumentType<Document, Introspection, Fragments> extends infer Result
    ? Result extends never
      ? never
      : TadaDocumentNode<
          Result,
          getVariablesType<Document, Introspection>,
          decorateFragmentDef<Document>
        >
    : never
  : never;

function graphql<
  const In extends stringLiteral<In>,
  const Fragments extends readonly [...FragmentDefDecorationLike[]],
>(
  input: In,
  fragments?: Fragments
): getDocumentNode<In, Schema, getFragmentsOfDocumentsRec<Fragments>> {
  const definitions = _parse(input).definitions as DefinitionNode[];
  const fragmentNames = new Map<string, unknown>();
  for (const document of fragments || []) {
    for (const definition of document.definitions) {
      if (definition.kind !== Kind.FRAGMENT_DEFINITION) {
        /*noop*/
      } else if (!fragmentNames.has(definition.name.value)) {
        fragmentNames.set(definition.name.value, definition);
        definitions.push(definition);
      } else if (
        process.env.NODE_ENV !== 'production' &&
        fragmentNames.get(definition.name.value) !== definition
      ) {
        // Fragments with the same names is expected to have the same contents
        console.warn(
          '[WARNING: Duplicate Fragment] A fragment with name `' +
            definition.name.value +
            '` already exists in this document.\n' +
            'While fragment names may not be unique across your source, each name must be unique per document.'
        );
      }
    }
  }
  return { kind: Kind.DOCUMENT, definitions } as any;
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
    FragmentDefDecoration<Decoration> {}

type ResultOf<T> = T extends DocumentDecoration<infer Result, infer _> ? Result : never;

type VariablesOf<T> = T extends DocumentDecoration<infer _, infer Variables> ? Variables : never;

export { parse, graphql };
export type { setupSchema, TadaDocumentNode, ResultOf, VariablesOf };
