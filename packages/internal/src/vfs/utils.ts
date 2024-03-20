import { ScriptTarget } from 'typescript';

export type TargetCache<T> = { readonly _opaque: unique symbol } & Record<string, T | null>;

function createTargetCache<T>(): TargetCache<T> {
  return {
    [ScriptTarget[ScriptTarget.ES3]]: null,
    [ScriptTarget[ScriptTarget.ES5]]: null,
    [ScriptTarget[ScriptTarget.ES2015]]: null,
    [ScriptTarget[ScriptTarget.ES2016]]: null,
    [ScriptTarget[ScriptTarget.ES2017]]: null,
    [ScriptTarget[ScriptTarget.ES2018]]: null,
    [ScriptTarget[ScriptTarget.ES2019]]: null,
    [ScriptTarget[ScriptTarget.ES2020]]: null,
    [ScriptTarget[ScriptTarget.ES2021]]: null,
    [ScriptTarget[ScriptTarget.ES2022]]: null,
    [ScriptTarget[ScriptTarget.Latest]]: null,
    [ScriptTarget[ScriptTarget.JSON]]: null,
  } as TargetCache<T>;
}

function setTargetCache<T>(cache: TargetCache<T>, key: ScriptTarget, value: T): T {
  cache[ScriptTarget[key]] = value;
  return value;
}

function getTargetCache<T>(cache: TargetCache<T>, key: ScriptTarget): T | null {
  return cache[ScriptTarget[key]] || null;
}

export { createTargetCache, setTargetCache, getTargetCache };
