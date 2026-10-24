/** Flattens an intersection of object types for readable type output */
export type obj<T> = T extends { [key: string | number]: any } ? { [K in keyof T]: T[K] } : never;
