import { describe, it, expectTypeOf } from 'vitest';

import type { simpleSchema } from './fixtures/simpleSchema';
import type { parseDocument } from '../parser';
import type { ResultOf, FragmentOf, mirrorFragmentTypeRec, getDocumentNode } from '../api';
import { readFragment } from '../api';

type schema = simpleSchema;
type value = { __value: true };
type data = { __data: true };

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
});
