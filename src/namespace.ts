declare namespace tada {
  const fragmentRefs: unique symbol;
  export type fragmentRefs = typeof fragmentRefs;

  const fragmentDefs: unique symbol;
  export type fragmentDefs = typeof fragmentDefs;
}

export type { tada };
