import { parse as _parse } from '@0no-co/graphql.web';

import type {
  IntrospectionQuery,
  ScalarsLike,
  IntrospectionLikeType,
  mapIntrospection,
} from './introspection';

import type {
  decorateDocument,
  getFragmentsOfDocumentsRec,
  FragmentDocumentNode,
} from './namespace';

import type { getDocumentType } from './selection';
import type { getVariablesType } from './variables';
import type { parseDocument, DocumentNodeLike } from './parser';
import type { stringLiteral, TypedDocumentNode } from './utils';

interface AbstractSetupSchema {
  introspection: IntrospectionQuery;
  scalars: ScalarsLike;
}

interface setupSchema extends AbstractSetupSchema {
  /*empty*/
}

type Schema = mapIntrospection<
  setupSchema['introspection'] extends IntrospectionQuery ? setupSchema['introspection'] : never,
  setupSchema['scalars'] extends ScalarsLike ? setupSchema['scalars'] : {}
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
      : TypedDocumentNode<Result, getVariablesType<Document, Introspection>> &
          decorateDocument<Document>
    : never
  : never;

function graphql<
  const In extends stringLiteral<In>,
  const Fragments extends readonly [...FragmentDocumentNode[]],
>(
  input: In,
  _fragments?: Fragments
): getDocumentNode<In, Schema, getFragmentsOfDocumentsRec<Fragments>> {
  return _parse(input) as any;
}

export { parse, graphql };
export type { setupSchema };
