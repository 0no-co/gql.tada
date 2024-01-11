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

/** Abstract configuration type input for your schema and scalars.
 *
 * @remarks
 * This is used either via {@link setupSchema} or {@link initGraphQLTada} to set
 * up your schema and scalars.
 *
 * The `scalars` option is optional and can be used to set up more scalars, apart
 * from the default ones (like: Int, Float, String, Boolean).
 * It must be an object map of scalar names to their desired TypeScript types.
 *
 * @param introspection - Introspection of your schema matching {@link IntrospectionQuery}.
 * @param scalars - An object type with scalar names as keys and the corresponding scalar types as values.
 */
interface AbstractSetupSchema {
  introspection: IntrospectionQuery;
  scalars?: ScalarsLike;
}

/** This is used to configure gql.tada with your introspection data and scalars.
 *
 * @remarks
 * You may extend this interface via declaration merging with your {@link IntrospectionQuery}
 * data and optionally your scalars to get proper type inference.
 * This is done by declaring a declaration for it as per the following example.
 *
 * Configuring scalars is optional and by default the standard scalrs are already
 * defined.
 *
 * This will configure the {@link graphql} export to infer types from your schema.
 * Alternatively, you may call {@link initGraphQLTada} instead.
 *
 * @param introspection - Introspection of your schema matching {@link IntrospectionQuery}.
 * @param scalars - An object type with scalar names as keys and the corresponding scalar types as values.
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

interface GraphQLTadaAPI<Schema extends IntrospectionLikeType> {
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
  <
    const In extends stringLiteral<In>,
    const Fragments extends readonly [...DocumentDefDecorationLike[]],
  >(
    input: In,
    fragments?: Fragments
  ): getDocumentNode<parseDocument<In>, Schema, getFragmentsOfDocumentsRec<Fragments>>;
}

/** Setup function to create a typed `graphql` document function with.
 *
 * @remarks
 * `initGraphQLTada` accepts an {@link AbstractSetupSchema} configuration object as a generic
 * and returns a `graphql` function that may be used to create documents typed using your
 * GraphQL schema.
 *
 * You should use and re-export the resulting function named as `graphql` or `gql` for your
 * editor and the TypeScript language server to recognize your GraphQL documents correctly.
 *
 * @example
 *
 * ```
 * import { initGraphQLTada } from 'gql.tada';
 * import { myIntrospection } from './myIntrospection';
 *
 * export const graphql = initGraphQLTada<{
 *   introspection: typeof myIntrospection;
 *   scalars: {
 *     DateTime: string;
 *     Json: any;
 *   };
 * }>();
 *
 * const query = graphql(`{ __typename }`);
 * ```
 */
function initGraphQLTada<const Setup extends AbstractSetupSchema>() {
  type Schema = mapIntrospection<
    matchOr<IntrospectionQuery, Setup['introspection'], never>,
    matchOr<ScalarsLike, Setup['scalars'], {}>
  >;

  return function graphql(input: string, fragments?: readonly DocumentDefDecorationLike[]): any {
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
  } as GraphQLTadaAPI<Schema>;
}

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

const graphql = initGraphQLTada<setupSchema>();

export { parse, graphql, readFragment, initGraphQLTada };
export type {
  setupSchema,
  parseDocument,
  AbstractSetupSchema,
  GraphQLTadaAPI,
  TadaDocumentNode,
  ResultOf,
  VariablesOf,
  FragmentOf,
};
