declare namespace tada {
  const fragmentRefs: unique symbol;
  export type fragmentRefs = typeof fragmentRefs;

  const fragmentName: unique symbol;
  export type fragmentName = typeof fragmentName;
}

export type { tada };
