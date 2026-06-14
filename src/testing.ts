import type { DocumentDecoration, obj, overload } from './utils';
import type { $tada, FragmentShape } from './namespace';
import type { ResultOf } from './api';

export { maskFragments, unsafe_readResult } from './api';

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

export { readResult };
