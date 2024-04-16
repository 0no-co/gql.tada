import { describe, it, expectTypeOf } from 'vitest';

import type { simpleSchema } from './fixtures/simpleSchema';
import type { simpleIntrospection } from './fixtures/simpleIntrospection';

import type { parseDocument } from '../parser';
import type { $tada, getFragmentsOfDocuments } from '../namespace';
import type { obj } from '../utils';

import { readFragment, maskFragments, unsafe_readResult, initGraphQLTada } from '../api';

import type { ResultOf, VariablesOf, FragmentOf, getDocumentNode } from '../api';

type schema = simpleSchema;

describe('graphql()', () => {
  const graphql = initGraphQLTada<{ introspection: simpleIntrospection }>();

  it('should create a fragment mask on masked fragments', () => {
    const fragment = graphql(`
      fragment Fields on Todo {
        id
        text
      }
    `);

    const query = graphql(
      `
        query Test($limit: Int) {
          todos(limit: $limit) {
            ...Fields
          }
        }
      `,
      [fragment]
    );

    expectTypeOf<FragmentOf<typeof fragment>>().toEqualTypeOf<{
      [$tada.fragmentRefs]: {
        Fields: 'Todo';
      };
    }>();

    expectTypeOf<ResultOf<typeof query>>().toEqualTypeOf<{
      todos:
        | ({
            [$tada.fragmentRefs]: {
              Fields: 'Todo';
            };
          } | null)[]
        | null;
    }>();

    expectTypeOf<VariablesOf<typeof query>>().toEqualTypeOf<{
      limit?: number | null;
    }>();
  });

  it('should create a fragment type on unmasked fragments', () => {
    const fragment = graphql(`
      fragment Fields on Todo @_unmask {
        id
        text
      }
    `);

    const query = graphql(
      `
        query Test($limit: Int) {
          todos(limit: $limit) {
            ...Fields
          }
        }
      `,
      [fragment]
    );

    expectTypeOf<FragmentOf<typeof fragment>>().toEqualTypeOf<{
      id: string;
      text: string;
    }>();

    expectTypeOf<ResultOf<typeof query>>().toEqualTypeOf<{
      todos:
        | ({
            id: string;
            text: string;
          } | null)[]
        | null;
    }>();

    expectTypeOf<VariablesOf<typeof query>>().toEqualTypeOf<{
      limit?: number | null;
    }>();
  });

  // See: https://github.com/0no-co/gql.tada/issues/100#issuecomment-1974924487
  it('should create a fragment type on unmasked fragments on nested interface', () => {
    const fragment = graphql(`
      fragment Fields on ITodo @_unmask {
        __typename
        id
      }
    `);

    const query = graphql(
      `
        query Test {
          itodo {
            ...Fields
            ... on BigTodo {
              wallOfText
            }
            ... on SmallTodo {
              id
              maxLength
            }
          }
        }
      `,
      [fragment]
    );

    expectTypeOf<FragmentOf<typeof fragment>>().toEqualTypeOf<
      | {
          __typename: 'BigTodo';
          id: string;
        }
      | {
          __typename: 'SmallTodo';
          id: string;
        }
    >();

    expectTypeOf<ResultOf<typeof query>>().toEqualTypeOf<{
      itodo:
        | {
            __typename: 'BigTodo';
            id: string;
            wallOfText: string | null;
          }
        | {
            __typename: 'SmallTodo';
            id: string;
            maxLength: number | null;
          };
    }>();
  });
});

describe('graphql() with custom scalars', () => {
  enum TestEnum {
    value = 'value',
    test = 'test',
  }

  const graphql = initGraphQLTada<{
    introspection: simpleIntrospection;
    scalars: {
      ID: [string];
      String: { value: string };
      test: TestEnum;
    };
  }>();

  it('should create a unmasked fragment type with custom scalars', () => {
    const fragment = graphql(`
      fragment Fields on Todo @_unmask {
        id
        text
        test
      }
    `);

    const query = graphql(
      `
        query Test($limit: Int) {
          todos(limit: $limit) {
            ...Fields
          }
        }
      `,
      [fragment]
    );

    expectTypeOf<FragmentOf<typeof fragment>>().toEqualTypeOf<{
      id: [string];
      text: { value: string };
      test: TestEnum | null;
    }>();

    expectTypeOf<ResultOf<typeof query>>().toEqualTypeOf<{
      todos:
        | ({
            id: [string];
            text: { value: string };
            test: TestEnum | null;
          } | null)[]
        | null;
    }>();

    expectTypeOf<VariablesOf<typeof query>>().toEqualTypeOf<{
      limit?: number | null;
    }>();
  });
});

describe('graphql() with pre-processed schema', () => {
  const graphql = initGraphQLTada<{
    introspection: simpleSchema;
    scalars: {
      ID: number;
    };
  }>();

  it('should create a unmasked fragment type with custom scalars', () => {
    const fragment = graphql(`
      fragment Fields on Todo @_unmask {
        id
        text
      }
    `);

    const query = graphql(
      `
        query Test($limit: Int) {
          todos(limit: $limit) {
            ...Fields
          }
        }
      `,
      [fragment]
    );

    expectTypeOf<FragmentOf<typeof fragment>>().toEqualTypeOf<{
      id: number;
      text: string;
    }>();

    expectTypeOf<ResultOf<typeof query>>().toEqualTypeOf<{
      todos:
        | ({
            id: number;
            text: string;
          } | null)[]
        | null;
    }>();

    expectTypeOf<VariablesOf<typeof query>>().toEqualTypeOf<{
      limit?: number | null;
    }>();
  });
});

describe('graphql() with `disableMasking: true`', () => {
  const graphql = initGraphQLTada<{ introspection: simpleIntrospection; disableMasking: true }>();
  it('should support unmasked fragments via the `disableMasking` option', () => {
    const fragment = graphql(`
      fragment Fields on Todo {
        id
        text
      }
    `);

    const query = graphql(
      `
        query Test($limit: Int) {
          todos(limit: $limit) {
            ...Fields
          }
        }
      `,
      [fragment]
    );

    expectTypeOf<FragmentOf<typeof fragment>>().toEqualTypeOf<{
      id: string;
      text: string;
    }>();

    expectTypeOf<ResultOf<typeof query>>().toEqualTypeOf<{
      todos:
        | ({
            id: string;
            text: string;
          } | null)[]
        | null;
    }>();

    expectTypeOf<VariablesOf<typeof query>>().toEqualTypeOf<{
      limit?: number | null;
    }>();
  });
});

describe('graphql.scalar()', () => {
  const graphql = initGraphQLTada<{ introspection: simpleIntrospection }>();

  it('should reject invalid types', () => {
    type actual = ReturnType<typeof graphql.scalar<'invalid'>>;
    expectTypeOf<actual>().toEqualTypeOf<never>();

    // @ts-expect-error
    const actual = graphql.scalar('invalid', 123);
  });

  it('should return the type of a given enum', () => {
    type actual = ReturnType<typeof graphql.scalar<'test'>>;
    type expected = 'value' | 'more';
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('should return the type of a given enum', () => {
    type actual = ReturnType<typeof graphql.scalar<'String'>>;
    expectTypeOf<actual>().toEqualTypeOf<string>();
  });

  it('should narrow the type of a passed value', () => {
    const actual = graphql.scalar('test', 'more');
    expectTypeOf<typeof actual>().toEqualTypeOf<'more'>();
  });

  it('should accept the type or null of a passed value', () => {
    const input: null | 'more' = {} as any;
    const actual = graphql.scalar('test', input);
    expectTypeOf<typeof actual>().toEqualTypeOf<'more' | null>();
  });

  it('should reject invalid values of a passed value', () => {
    // @ts-expect-error
    const actual = graphql.scalar('test', 'invalid');
  });

  it('should reject invalid names of types', () => {
    // @ts-expect-error
    const actual = graphql.scalar('what', null);
  });
});

describe('graphql.scalar() with custom scalars', () => {
  const graphql = initGraphQLTada<{
    introspection: simpleIntrospection;
    scalars: {
      ID: [string];
      String: { value: string };
    };
  }>();

  it('should return the type of custom ID type', () => {
    type actual = ReturnType<typeof graphql.scalar<'ID'>>;
    expectTypeOf<actual>().toEqualTypeOf<[string]>();
  });

  it('should return the type of custom String type', () => {
    type actual = ReturnType<typeof graphql.scalar<'String'>>;
    expectTypeOf<actual>().toEqualTypeOf<{ value: string }>();
  });
});

describe('readFragment', () => {
  it('should not accept a non-fragment document', () => {
    type query = parseDocument<`
      query Test {
        __typename
      }
    `>;

    type document = getDocumentNode<query, schema>;
    // @ts-expect-error
    const result = readFragment({} as document, {} as FragmentOf<document>);
    // TODO: Ensure this is never
    expectTypeOf<typeof result>().toBeAny();
  });

  it('should not accept empty objects', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo {
        id
      }
    `>;

    type document = getDocumentNode<fragment, schema>;
    // @ts-expect-error
    const _result = readFragment({} as document, {});
  });

  it('unmasks regular fragments', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo {
        id
      }
    `>;

    type document = getDocumentNode<fragment, schema>;
    const result = readFragment({} as document, {} as FragmentOf<document>);
    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<document>>();
  });

  it('unmasks regular fragments passed as generics', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo {
        id
      }
    `>;

    type document = getDocumentNode<fragment, schema>;
    const result = readFragment<document>({} as FragmentOf<document>);
    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<document>>();
  });

  it('falls back to unmasking to `never` with a missing generic', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo {
        id
      }
    `>;

    type document = getDocumentNode<fragment, schema>;
    // @ts-expect-error
    const _result = readFragment({} as FragmentOf<document>);
  });

  it('should be callable on already unmasked fragments', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo {
        id
      }
    `>;

    type document = getDocumentNode<fragment, schema>;
    const result = readFragment({} as document, {} as FragmentOf<document>);
    const result2 = readFragment({} as document, result);
    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<document>>();
    expectTypeOf<typeof result2>().toEqualTypeOf<ResultOf<document>>();
    expectTypeOf<typeof result2>().toEqualTypeOf<typeof result>();
  });

  it('unmasks fragments with optional spreads', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo {
        ... @defer {
          id
        }
      }
    `>;

    type document = getDocumentNode<fragment, schema>;
    const result = readFragment({} as document, {} as FragmentOf<document>);
    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<document>>();
  });

  it('unmasks fragments of interfaces', () => {
    type fragment = parseDocument<`
      fragment Fields on ITodo {
        id
        ... on BigTodo {
          wallOfText
        }
        ... on SmallTodo {
          maxLength
        }
      }
    `>;

    type document = getDocumentNode<fragment, schema>;
    const result = readFragment({} as document, {} as FragmentOf<document>);
    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<document>>();
  });

  it('unmasks fragments of interfaces with optional spreads', () => {
    type fragment = parseDocument<`
      fragment Fields on ITodo {
        ... on ITodo @defer {
          id
        }
      }
    `>;

    type document = getDocumentNode<fragment, schema>;
    const result = readFragment({} as document, {} as FragmentOf<document>);
    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<document>>();
  });

  it('should behave correctly on unmasked fragments', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo @_unmask {
        id
      }
    `>;

    type document = getDocumentNode<fragment, schema>;
    const result = readFragment({} as document, {} as FragmentOf<document>);
    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<document>>();
  });
});

describe('maskFragments', () => {
  it('should not accept empty objects', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo {
        id
      }
    `>;

    type document = getDocumentNode<fragment, schema>;
    // @ts-expect-error
    const _result = maskFragments([{} as document], {});
  });

  it('masks fragments', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo {
        id
      }
    `>;

    type document = getDocumentNode<fragment, schema>;
    const result = maskFragments([{} as document], { id: 'id' });
    expectTypeOf<typeof result>().toEqualTypeOf<FragmentOf<document>>();
  });

  it('masks arrays of fragment data', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo {
        id
      }
    `>;

    type document = getDocumentNode<fragment, schema>;
    const result = maskFragments([{} as document], [{ id: 'id' }]);
    expectTypeOf<typeof result>().toEqualTypeOf<readonly FragmentOf<document>[]>();
  });

  it('masks multiple fragments', () => {
    type fragmentA = parseDocument<`
      fragment FieldsA on Todo {
        a: id
      }
    `>;

    type fragmentB = parseDocument<`
      fragment FieldsB on Todo {
        b: id
      }
    `>;

    type documentA = getDocumentNode<fragmentA, schema>;
    type documentB = getDocumentNode<fragmentB, schema>;
    const result = maskFragments([{} as documentA, {} as documentB], { a: 'id', b: 'id' });
    type expected = obj<FragmentOf<documentA> & FragmentOf<documentB>>;
    expectTypeOf<typeof result>().toEqualTypeOf<expected>();
  });

  it('should behave correctly on unmasked fragments', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo @_unmask {
        id
      }
    `>;

    type document = getDocumentNode<fragment, schema>;
    const result = maskFragments([{} as document], { id: 'id' });
    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<document>>();
  });
});

describe('unsafe_readResult', () => {
  it('should cast result data', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo {
        fields: id
      }
    `>;

    type query = parseDocument<`
      query Test {
        todos {
          id
          ...Fields
        }
      }
    `>;

    type fragmentDoc = getDocumentNode<fragment, schema>;
    type document = getDocumentNode<query, schema, getFragmentsOfDocuments<[fragmentDoc]>>;

    const result = unsafe_readResult({} as document, {
      todos: [
        {
          id: 'id',
          fields: 'id',
        },
      ],
    });

    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<document>>();
  });

  it('should cast result data of arrays', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo {
        fields: id
      }
    `>;

    type query = parseDocument<`
      query Test {
        todos {
          id
          ...Fields
        }
      }
    `>;

    type fragmentDoc = getDocumentNode<fragment, schema>;
    type document = getDocumentNode<query, schema, getFragmentsOfDocuments<[fragmentDoc]>>;

    const result = unsafe_readResult({} as document, {
      todos: [
        {
          id: 'id',
          fields: 'id',
        },
      ],
    });

    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<document>>();
  });
});

describe('graphql.persisted()', () => {
  const graphql = initGraphQLTada<{ introspection: simpleIntrospection }>();

  const query = graphql(`
    query Test {
      __typename
    }
  `);

  it('should take on the value of the document', () => {
    const persisted = graphql.persisted<typeof query>('Test');
    expectTypeOf<typeof persisted>().toMatchTypeOf<typeof query>();
    expectTypeOf<ResultOf<typeof persisted>>().toEqualTypeOf<ResultOf<typeof query>>();
    expectTypeOf<VariablesOf<typeof persisted>>().toEqualTypeOf<VariablesOf<typeof query>>();
  });

  it('should require a document to be passed as a generic', () => {
    const persisted = graphql.persisted('Test');
    expectTypeOf<typeof persisted>().toBeNever();

    // @ts-expect-error
    graphql.persisted<number>('Test');
  });
});
