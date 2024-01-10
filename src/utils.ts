/** Constraints a given string to a string literal. */
export type stringLiteral<T extends string> = string extends T ? never : string;

/** Returns `T` if it matches `Constraint` without being equal to it. Failing this evaluates to `Fallback` otherwise. */
export type matchOr<Constraint, T, Fallback> = Constraint extends T
  ? Fallback
  : T extends Constraint
    ? T
    : Fallback;

/** Flattens a given object type.
 *
 * @remarks
 * This is typically used to make a TypeScript type appear as a flat object,
 * both in terms of type checking and for type hints and the tsserver output.
 */
export type obj<T> = T extends { [key: string | number]: any }
  ? T extends infer U
    ? { [K in keyof U]: U[K] }
    : never
  : never;

/** Retrieves all non-nullish value types of an object dictionary. */
export type objValues<T> = T[keyof T] extends infer U
  ? U extends null | undefined | never | void
    ? never
    : U
  : never;

/** Annotations for GraphQL’s `DocumentNode` with attached generics for its result data and variables types.
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
export interface DocumentDecoration<
  Result = { [key: string]: any },
  Variables = { [key: string]: any },
> {
  /** Type to support `@graphql-typed-document-node/core`
   * @internal
   */
  __apiType?: (variables: Variables) => Result;
  /** Type to support `TypedQueryDocumentNode` from `graphql`
   * @internal
   */
  __ensureTypesOfVariablesAndResultMatching?: (variables: Variables) => Result;
}
