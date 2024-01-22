import { describe, it, expectTypeOf } from 'vitest';

import type { simpleSchema } from './fixtures/simpleSchema';
import type { simpleIntrospection } from './fixtures/simpleIntrospection';

import type { parseDocument } from '../parser';
import type { $tada } from '../namespace';
import { readFragment, initGraphQLTada } from '../api';

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

describe('Public API', () => {
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
