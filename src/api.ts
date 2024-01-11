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

/** Private interface used to constrain [setupSchema]. */
interface AbstractSetupSchema {
  introspection: IntrospectionQuery;
  scalars: ScalarsLike;
}

/** This is used to configure gql.tada with your introspection data and scalars.
 *
 * @remarks
 * You must extend this interface via declaration merging with your {@link IntrospectionQuery}
 * data and optionally your scalars to get proper type inference.
 * This is done by declaring a declaration for it as per the following example.
 *
 * Configuring scalars is optional and by default the standard scalrs are already
 * defined.
 *
 * @example
 *
 * ```
 * import { myIntrospection } from './myIntrospection';
 *
 * declare module 'gql.tada' {
 *   interface setupSchema {
 *     introspection: typeof myIntrospection;
 *     scalars: {
 *       DateTime: string;
 *       Json: any;
 *     };
 *   }
 * }
 * ```
 */
interface setupSchema extends AbstractSetupSchema {
  /*empty*/
}

type Schema = mapIntrospection<
  matchOr<IntrospectionQuery, setupSchema['introspection'], never>,
  matchOr<ScalarsLike, setupSchema['scalars'], {}>
>;

/** Alias to a GraphQL parse function returning an exact document type.
 *
 * @param input - A string of a GraphQL document
 * @returns A parsed {@link DocumentNode}.
 *
 * @remarks
 * This function accepts a GraphQL document string and parses it, just like
 * GraphQL’s `parse` function. However, its return type will be the exact
 * structure of the AST parsed in types.
 */
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

/** Function to create and compose GraphQL documents with result and variable types.
 *
 * @param input - A string of a GraphQL document.
 * @param fragments - An optional list of other GraphQL fragments created with this function.
 * @returns A {@link DocumentNode} with result and variables types.
 *
 * @remarks
 * This function creates a {@link DocumentNode} with result and variables types.
 * It is used with your schema in {@link setupSchema} to create a result type
 * of your queries, fragments, and variables.
 *
 * You can compose fragments into this function by passing them and a fragment
 * mask will be created for them.
 * When creating queries, the returned document of queries can be passed into GraphQL clients
 * which will then automatically infer the result and variables types.
 *
 * @example
 *
 * ```
 * import { graphql } from 'gql.tada';
 *
 * const bookFragment = graphql(`
 *   fragment BookComponent on Book {
 *     id
 *     title
 *   }
 * `);
 *
 * const bookQuery = graphql(`
 *   query Book ($id: ID!) {
 *     book(id: $id) {
 *       id
 *       ...BookComponent
 *     }
 *   }
 * `, [bookFragment]);
 * ```
 *
 * @see {@link readFragment} for how to read from fragment masks.
 */
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

/** A GraphQL `DocumentNode` with attached types for results and variables.
 *
 * @remarks
 * This is a GraphQL {@link DocumentNode} with attached types for results and variables.
 * This is used by GraphQL clients to infer the types of results and variables and provide
 * type-safety in GraphQL documents.
 *
 * You can create typed GraphQL documents using the {@link graphql} function.
 *
 * `Result` is the type of GraphQL results, as returned by GraphQL APIs for a given query.
 * `Variables` is the type of variables, as accepted by GraphQL APIs for a given query.
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

/** A utility type returning the `Result` type of typed GraphQL documents.
 *
 * @remarks
 * This accepts a {@link TadaDocumentNode} and returns the attached `Result` type
 * of GraphQL documents.
 */
type ResultOf<Document> = Document extends DocumentDecoration<infer Result, infer _>
  ? Result
  : never;

/** A utility type returning the `Variables` type of typed GraphQL documents.
 *
 * @remarks
 * This accepts a {@link TadaDocumentNode} and returns the attached `Variables` type
 * of GraphQL documents.
 */
type VariablesOf<Document> = Document extends DocumentDecoration<infer _, infer Variables>
  ? Variables
  : never;

/** Creates a fragment mask for a given fragment document.
 *
 * @remarks
 * When {@link graphql} is used to create a fragment and is spread into another
 * fragment or query, their result types will only contain a “reference” to the
 * fragment. This encourages isolation and is known as “fragment masking.”
 *
 * While {@link readFragment} is used to unmask these fragment masks, this utility
 * creates a fragment mask, so you can accept the masked data in the part of your
 * codebase that defines a fragment.
 *
 * @example
 *
 * ```
 * import { FragmentOf, graphql, readFragment } from 'gql.tada';
 *
 * const bookFragment = graphql(`
 *   fragment BookComponent on Book {
 *     id
 *     title
 *   }
 * `);
 *
 * // May be called with any GraphQL data that contains a spread of `bookFragment`
 * const getBook = (data: FragmentOf<typeof bookFragment>) => {
 *   // Unmasks the fragment and casts to the result type of `bookFragment`
 *   const book = readFragment(bookFragment, data);
 * };
 * ```
 *
 * @see {@link readFragment} for how to read from fragment masks.
 */
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

/** Unmasks a fragment mask for a given fragment document and data.
 *
 * @param _document - A GraphQL document of a fragment, created using {@link graphql}.
 * @param fragment - A mask of the fragment, which can be wrapped in arrays, or nullable.
 * @returns The unmasked data of the fragment.
 *
 * @remarks
 * When {@link graphql} is used to create a fragment and is spread into another
 * fragment or query, their result types will only contain a “reference” to the
 * fragment. This encourages isolation and is known as “fragment masking.”
 *
 * This means that you must use {@link readFragment} to unmask these fragment masks
 * and get to the data. This encourages isolation and only using the data you define
 * a part of your codebase to require.
 *
 * @example
 *
 * ```
 * import { FragmentOf, graphql, readFragment } from 'gql.tada';
 *
 * const bookFragment = graphql(`
 *   fragment BookComponent on Book {
 *     id
 *     title
 *   }
 * `);
 *
 * const getBook = (data: FragmentOf<typeof bookFragment> | null) => {
 *   // Unmasks the fragment and casts to the result type of `bookFragment`
 *   // This is intersected with `| null` in this case, due to the input type.
 *   const book = readFragment(bookFragment, data);
 * };
 *
 * const bookQuery = graphql(`
 *   query Book ($id: ID!) {
 *     book(id: $id) {
 *       id
 *       ...BookComponent
 *     }
 *   }
 * `, [bookFragment]);
 *
 * const getQuery = (data: ResultOf<typeof bookQuery>) => {
 *   getBook(data?.book);
 * };
 * ```
 *
 * @see {@link readFragment} for how to read from fragment masks.
 */
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
