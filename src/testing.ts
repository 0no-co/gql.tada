import type { DocumentDecoration, obj, overload } from './utils';
import type { $tada, FragmentShape, omitFragmentRefsRec, makeFragmentRef } from './namespace';
import type { ResultOf } from './api';

type fragmentRegistryEntry<Fragment> =
  Fragment extends FragmentShape<infer Definition, infer Result>
    ? { [Name in Definition['fragment']]: Result }
    : never;

type fragmentRegistry<Fragments extends readonly FragmentShape[]> = overload<
  fragmentRegistryEntry<Fragments[number]> | {}
>;

type unmaskFragmentSpreadsRec<Refs, Registry> = overload<
  keyof Refs extends infer Name
    ? Name extends keyof Registry
      ? unmaskFragmentRefsRec<Registry[Name], Registry>
      : Name extends keyof Refs
        ? { [$tada.fragmentRefs]: { [N in Name]: Refs[N] } }
        : never
    : never
>;

type unmaskFragmentRefsRec<Data, Registry> = Data extends readonly (infer Value)[]
  ? readonly unmaskFragmentRefsRec<Value, Registry>[]
  : Data extends null
    ? null
    : Data extends undefined
      ? undefined
      : Data extends { [$tada.fragmentRefs]: infer Refs }
        ? obj<
            {
              [Key in Exclude<keyof Data, $tada.fragmentRefs>]: unmaskFragmentRefsRec<
                Data[Key],
                Registry
              >;
            } & unmaskFragmentSpreadsRec<Refs, Registry>
          >
        : Data extends object
          ? { [Key in keyof Data]: unmaskFragmentRefsRec<Data[Key], Registry> }
          : Data;

/** For testing, converts document data to its result type, resolving nested fragments.
 *
 * @param _document - A GraphQL document, created using `graphql`.
 * @param data - The result data of the document, with fragment data inlined.
 * @param _fragments - A list of every fragment used in the document, transitively.
 * @returns The result data, cast to the result type of the document.
 *
 * @remarks
 * When a document spreads fragments, its result type only contains opaque
 * references to them, rather than the fragments’ fields, which makes it hard to
 * write a fixture for the full result.
 *
 * Unlike `unsafe_readResult`, which discards all fragment references and checks
 * nothing nested inside them, `readResult` accepts the document’s fragments and
 * recursively resolves their references, so your data is fully type-checked —
 * including fragments that spread other fragments.
 *
 * Any fragment you leave out of the `fragments` argument stays masked, so a
 * missing fragment surfaces as a still-masked reference rather than inlined data,
 * and can be filled with `maskFragments` instead.
 *
 * Intended for tests, storybooks, fixtures, and cache updaters.
 *
 * @example
 * ```
 * import { graphql } from 'gql.tada';
 * import { readResult } from 'gql.tada/testing';
 *
 * const authorFragment = graphql(`
 *   fragment AuthorFields on Author {
 *     name
 *   }
 * `);
 *
 * const todoFragment = graphql(`
 *   fragment TodoFields on Todo {
 *     id
 *     author {
 *       ...AuthorFields
 *     }
 *   }
 * `, [authorFragment]);
 *
 * const query = graphql(`
 *   query {
 *     todos {
 *       id
 *       ...TodoFields
 *     }
 *   }
 * `, [todoFragment]);
 *
 * const data = readResult(
 *   query,
 *   { todos: [{ id: 'id', author: { name: 'name' } }] },
 *   [todoFragment, authorFragment]
 * );
 * ```
 *
 * @see {@link maskFragments} for masking a single level of fragment data.
 * @see {@link unsafe_readResult} for the unsafe variant that performs no checks.
 */
function readResult<
  const Document extends DocumentDecoration<any, any>,
  const Fragments extends readonly FragmentShape[],
>(
  document: Document,
  data: unmaskFragmentRefsRec<ResultOf<Document>, fragmentRegistry<Fragments>>,
  fragments: Fragments
): ResultOf<Document>;

function readResult(_document: unknown, data: unknown, _fragments?: unknown): unknown {
  return data;
}

type resultOfFragmentsRec<
  Fragments extends readonly any[],
  Result = {},
> = Fragments extends readonly [infer Fragment, ...infer Rest]
  ? resultOfFragmentsRec<Rest, ResultOf<Fragment> & Result>
  : Result;

type fragmentRefsOfFragmentsRec<
  Fragments extends readonly any[],
  FragmentRefs = {},
> = Fragments extends readonly [infer Fragment, ...infer Rest]
  ? fragmentRefsOfFragmentsRec<Rest, makeFragmentRef<Fragment> & FragmentRefs>
  : obj<FragmentRefs>;

/** For testing, masks fragment data for given data and fragments.
 *
 * @param _fragments - A list of GraphQL documents of fragments, created using `graphql`.
 * @param data - The combined result data of the fragments, which can be wrapped in arrays.
 * @returns The masked data of the fragments.
 *
 * @remarks
 * When creating test data, you may define data for fragments that’s unmasked, making it
 * unusable in parent fragments or queries that require masked data.
 *
 * This means that you may have to use {@link maskFragments} to mask your data first
 * for TypeScript to not report an error.
 *
 * @example
 * ```
 * import { FragmentOf, ResultOf, graphql } from 'gql.tada';
 * import { maskFragments } from 'gql.tada/testing';
 *
 * const bookFragment = graphql(`
 *   fragment BookComponent on Book {
 *     id
 *     title
 *   }
 * `);
 *
 * const data = maskFragments([bookFragment], { id: 'id', title: 'book' });
 * ```
 *
 * @see {@link readFragment} for how to read from fragment masks (i.e. the reverse)
 */
function maskFragments<const Fragments extends readonly FragmentShape[]>(
  _fragments: Fragments,
  fragment: resultOfFragmentsRec<Fragments>
): fragmentRefsOfFragmentsRec<Fragments>;
function maskFragments<const Fragments extends readonly FragmentShape[]>(
  _fragments: Fragments,
  fragment: resultOfFragmentsRec<Fragments> | null
): fragmentRefsOfFragmentsRec<Fragments> | null;
function maskFragments<const Fragments extends readonly FragmentShape[]>(
  _fragments: Fragments,
  fragment: resultOfFragmentsRec<Fragments> | undefined
): fragmentRefsOfFragmentsRec<Fragments> | undefined;
function maskFragments<const Fragments extends readonly FragmentShape[]>(
  _fragments: Fragments,
  fragment: resultOfFragmentsRec<Fragments> | null | undefined
): fragmentRefsOfFragmentsRec<Fragments> | null | undefined;
function maskFragments<const Fragments extends readonly FragmentShape[]>(
  _fragments: Fragments,
  fragment: readonly resultOfFragmentsRec<Fragments>[]
): readonly fragmentRefsOfFragmentsRec<Fragments>[];
function maskFragments<const Fragments extends readonly FragmentShape[]>(
  _fragments: Fragments,
  fragment: readonly (resultOfFragmentsRec<Fragments> | null)[]
): readonly (fragmentRefsOfFragmentsRec<Fragments> | null)[];
function maskFragments<const Fragments extends readonly FragmentShape[]>(
  _fragments: Fragments,
  fragment: readonly (resultOfFragmentsRec<Fragments> | undefined)[]
): readonly (fragmentRefsOfFragmentsRec<Fragments> | undefined)[];
function maskFragments<const Fragments extends readonly FragmentShape[]>(
  _fragments: Fragments,
  fragment: readonly (resultOfFragmentsRec<Fragments> | null | undefined)[]
): readonly (fragmentRefsOfFragmentsRec<Fragments> | null | undefined)[];
function maskFragments(_fragments: unknown, data: unknown) {
  return data;
}

/** For testing, converts document data without fragment refs to their result type.
 *
 * @param _document - A GraphQL document, created using `graphql`.
 * @param data - The result data of the GraphQL document with optional fragment refs.
 * @returns The masked result data of the document.
 *
 * @remarks
 * When creating test data, you may define data for documents that’s unmasked, but
 * need to cast the data to match the result type of your document.
 *
 * This means that you may have to use {@link unsafe_readResult} to cast
 * them to the result type, instead of doing `as any as ResultOf<typeof document>`.
 *
 * This function is inherently unsafe, since it doesn't check that your document
 * actually contains the masked fragment data! For a type-safe alternative that
 * resolves nested fragments, see {@link readResult}.
 *
 * @example
 * ```
 * import { FragmentOf, ResultOf, graphql } from 'gql.tada';
 * import { unsafe_readResult } from 'gql.tada/testing';
 *
 * const bookFragment = graphql(`
 *   fragment BookComponent on Book {
 *     id
 *     title
 *   }
 * `);
 *
 * const query = graphql(`
 *   query {
 *     book {
 *       ...BookComponent
 *     }
 *   }
 * `, [bookFragment]);
 *
 * const data = unsafe_readResult(query, { book: { id: 'id', title: 'book' } });
 * ```
 *
 * @see {@link readResult} for a type-safe alternative that resolves nested fragments.
 * @see {@link readFragment} for how to read from fragment masks (i.e. the reverse)
 */
function unsafe_readResult<
  const Document extends DocumentDecoration<any, any>,
  const Data extends omitFragmentRefsRec<ResultOf<Document>>,
>(_document: Document, data: Data): ResultOf<Document> {
  return data as any;
}

export { readResult, maskFragments, unsafe_readResult };
