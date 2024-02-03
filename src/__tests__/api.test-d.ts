import { describe, it, expectTypeOf } from 'vitest';

import type { simpleSchema } from './fixtures/simpleSchema';
import type { simpleIntrospection } from './fixtures/simpleIntrospection';

import type { parseDocument } from '../parser';
import type { $tada, getFragmentsOfDocumentsRec } from '../namespace';
import type { obj } from '../utils';

import { readFragment, maskFragments, unsafe_readResult, initGraphQLTada } from '../api';

import type {
  ResultOf,
  VariablesOf,
  FragmentOf,
  mirrorFragmentTypeRec,
  getDocumentNode,
} from '../api';

type schema = simpleSchema;
type value = { __value: true };
type data = { __data: true };

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
        Fields: $tada.ref;
      };
    }>();

    expectTypeOf<ResultOf<typeof query>>().toEqualTypeOf<{
      todos:
        | ({
            [$tada.fragmentRefs]: {
              Fields: $tada.ref;
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
      id: string | number;
      text: string;
    }>();

    expectTypeOf<ResultOf<typeof query>>().toEqualTypeOf<{
      todos:
        | ({
            id: string | number;
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

describe('mirrorFragmentTypeRec', () => {
  it('mirrors null and undefined', () => {
    expectTypeOf<mirrorFragmentTypeRec<value, data>>().toEqualTypeOf<data>();
    expectTypeOf<mirrorFragmentTypeRec<value | null, data>>().toEqualTypeOf<data | null>();
    expectTypeOf<mirrorFragmentTypeRec<value | undefined, data>>().toEqualTypeOf<
      data | undefined
    >();
    expectTypeOf<mirrorFragmentTypeRec<value | null | undefined, data>>().toEqualTypeOf<
      data | null | undefined
    >();
  });

  it('mirrors nested arrays', () => {
    expectTypeOf<mirrorFragmentTypeRec<value[], data>>().toEqualTypeOf<data[]>();
    expectTypeOf<mirrorFragmentTypeRec<value[] | null, data>>().toEqualTypeOf<data[] | null>();
    expectTypeOf<mirrorFragmentTypeRec<(value | null)[] | null, data>>().toEqualTypeOf<
      (data | null)[] | null
    >();
    expectTypeOf<mirrorFragmentTypeRec<readonly value[], data>>().toEqualTypeOf<readonly data[]>();
  });

  it('mirrors complex types', () => {
    type complex = { a: true } | { b: true };
    type actual = mirrorFragmentTypeRec<value, complex>;
    expectTypeOf<actual>().toEqualTypeOf<complex>();
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
    expectTypeOf<typeof result>().toBeNever();
  });

  it('should not unmask empty objects', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo {
        id
      }
    `>;

    type document = getDocumentNode<fragment, schema>;
    // @ts-expect-error
    const result = readFragment({} as document, {});
    expectTypeOf<typeof result>().toBeNever();
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
  it('should not mask empty objects', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo {
        id
      }
    `>;

    type document = getDocumentNode<fragment, schema>;
    // @ts-expect-error
    const result = maskFragments([{} as document], {});
    expectTypeOf<typeof result>().toBeNever();
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
        latestTodo {
          id
          ...Fields
        }
      }
    `>;

    type fragmentDoc = getDocumentNode<fragment, schema>;
    type document = getDocumentNode<query, schema, getFragmentsOfDocumentsRec<[fragmentDoc]>>;

    const result = unsafe_readResult({} as document, {
      latestTodo: {
        id: 'id',
        fields: 'id',
      },
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
    type document = getDocumentNode<query, schema, getFragmentsOfDocumentsRec<[fragmentDoc]>>;

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
