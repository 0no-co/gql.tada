/** Flattens a given object type.
 *
 * @remarks
 * This is typically used to make a TypeScript type appear as a flat object,
 * both in terms of type checking and for type hints and the tsserver output.
 */
export type Obj<T> = T extends { [key: string | number]: any }
  ? T extends infer U
    ? { [K in keyof U]: U[K] }
    : never
  : never;

/** Retrieves all non-nullish value types of an object dictionary. */
export type ObjValues<T> = T[keyof T] extends infer U
  ? U extends null | undefined | never | void
    ? never
    : U
  : never;

/** Turns a union type into an overload/intersection type. */
export type Overload<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;
