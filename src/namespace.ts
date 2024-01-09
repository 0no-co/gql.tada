declare namespace tada {
  const fragmentRefs: unique symbol;
  export type fragmentRefs = typeof fragmentRefs;

  const fragmentName: unique symbol;
  export type fragmentName = typeof fragmentName;

  const fragmentCondition: unique symbol;
  export type fragmentCondition = typeof fragmentCondition;
}

export type { tada };
